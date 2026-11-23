interface ResponseLike {
  status: number;
  text: () => Promise<string>;
  clone?: () => { text: () => Promise<string> };
  headers?: {
    get?: (name: string) => string | null;
  };
}

function isResponseLike(value: unknown): value is ResponseLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as { status?: unknown }).status === 'number' &&
    'text' in value &&
    typeof (value as { text?: unknown }).text === 'function'
  );
}

function resolveResponse(error: unknown, response?: Response): ResponseLike | null {
  if (response && isResponseLike(response)) {
    return response;
  }
  if (typeof error === 'object' && error !== null && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (isResponseLike(context)) {
      return context;
    }
  }
  return null;
}

async function readResponseBodyText(res: ResponseLike): Promise<string> {
  try {
    const readable = typeof res.clone === 'function' ? res.clone() : res;
    return await readable.text();
  } catch {
    return '';
  }
}

function parseServerErrorPayload(bodyText: string): {
  serverError: string | null;
  serverCode: string | null;
} {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return { serverError: null, serverCode: null };
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        let serverError: string | null = null;
        for (const key of ['error', 'message', 'msg'] as const) {
          const val = parsed[key];
          if (typeof val === 'string' && val.trim()) {
            serverError = val.trim();
            break;
          }
        }
        const serverCode =
          typeof parsed.code === 'string' && parsed.code.trim() ? parsed.code.trim() : null;
        return { serverError, serverCode };
      }
    } catch {
      // Fall through to plain-text handling if JSON is malformed
    }
  }

  if (!/^<!doctype\s|^<html[\s>]/i.test(trimmed)) {
    return { serverError: trimmed.slice(0, 240), serverCode: null };
  }

  return { serverError: null, serverCode: null };
}

function formatHttpErrorMessage(
  status: number | null,
  serverError: string | null,
  serverCode: string | null,
  reqId: string,
  fallbackMessage: string
): string {
  const reqIdSuffix = reqId ? ` (request_id: ${reqId})` : '';

  if (status === 401 && serverCode !== 'TMDB_AUTH_ERROR') {
    return `Сессия истекла или недействительна (HTTP 401). Войдите в аккаунт заново.${reqIdSuffix}`;
  }

  if (status === 429 && serverCode === 'QUOTA_EXCEEDED') {
    return `${serverError || 'Превышен лимит записей в профиле.'} (HTTP 429)${reqIdSuffix}`;
  }

  if (status === 429) {
    return `Слишком много запросов к TMDB-прокси (HTTP 429). Подождите минуту и повторите попытку.${reqIdSuffix}`;
  }

  if (status === 413) {
    return `Слишком большой размер запроса (HTTP 413).${reqIdSuffix}`;
  }

  if (status === 504) {
    return `Превышено время ожидания Edge Function (HTTP 504). Попробуйте повторить.${reqIdSuffix}`;
  }

  if (status === 546) {
    return `Превышен лимит ресурсов Edge Function (HTTP 546). Попробуйте повторить.${reqIdSuffix}`;
  }

  if (serverError) {
    const includeCode = Boolean(serverCode && !serverError.includes(serverCode));
    const codePart = includeCode ? ` (${serverCode})` : '';
    if (status !== null) {
      return `HTTP ${status}${codePart}: ${serverError}${reqIdSuffix}`;
    }
    return `${includeCode ? `${serverCode}: ` : ''}${serverError}${reqIdSuffix}`;
  }

  if (status !== null) {
    return `${fallbackMessage} (HTTP ${status})${reqIdSuffix}`;
  }

  return fallbackMessage;
}

/**
 * Extracts a detailed, human-readable error message from a Supabase Edge Function
 * invocation error and/or its HTTP response.
 */
export async function extractEdgeFunctionErrorMessage(
  error: unknown,
  fallbackMessage: string,
  response?: Response
): Promise<string> {
  const res = resolveResponse(error, response);
  if (res) {
    const status =
      typeof res.status === 'number' && Number.isFinite(res.status) && res.status > 0
        ? res.status
        : null;
    const rawReqId = res.headers?.get?.('sb-request-id') ?? res.headers?.get?.('x-request-id') ?? '';
    const reqId = typeof rawReqId === 'string' ? rawReqId.trim().slice(0, 80) : '';
    const bodyText = await readResponseBodyText(res);
    const { serverError, serverCode } = parseServerErrorPayload(bodyText);
    return formatHttpErrorMessage(status, serverError, serverCode, reqId, fallbackMessage);
  }

  const errorName =
    typeof error === 'object' && error !== null && 'name' in error
      ? (error as { name?: unknown }).name
      : undefined;

  if (errorName === 'FunctionsFetchError') {
    const context = (error as { context?: unknown }).context;
    const rawCause =
      typeof context === 'object' && context !== null && 'message' in context
        ? (context as { message?: unknown }).message
        : undefined;
    const cause = typeof rawCause === 'string' ? rawCause.trim() : '';
    return cause
      ? `Сетевая ошибка при обращении к Edge Function: ${cause}`
      : 'Сетевая ошибка при обращении к Edge Function. Проверьте подключение к интернету.';
  }

  if (errorName === 'FunctionsRelayError') {
    return 'Ошибка шлюза Supabase Edge Functions (Relay). Повторите попытку.';
  }

  if (error instanceof Error) {
    const msg = error.message.trim();
    if (msg && msg !== 'Edge Function returned a non-2xx status code') {
      return msg;
    }
  }

  return fallbackMessage;
}
