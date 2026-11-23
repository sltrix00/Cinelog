import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { extractEdgeFunctionErrorMessage } from './edgeFunctionError';

describe('extractEdgeFunctionErrorMessage', () => {
  it('extracts JSON error payload on HTTP 500 instead of generic non-2xx message', async () => {
    const response = new Response(JSON.stringify({ error: 'Internal server error in tmdb-proxy' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
    const error = new FunctionsHttpError(response);

    const msg = await extractEdgeFunctionErrorMessage(error, 'Fallback error', response);
    expect(msg).toBe('HTTP 500: Internal server error in tmdb-proxy');
  });

  it('preserves TMDB_AUTH_ERROR on HTTP 401 instead of misclassifying as expired user session', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'TMDB auth error (401): ошибка авторизации внешнего сервиса TMDB.',
        code: 'TMDB_AUTH_ERROR',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const error = new FunctionsHttpError(response);

    const msg = await extractEdgeFunctionErrorMessage(error, 'Fallback error', response);
    expect(msg).toBe(
      'HTTP 401 (TMDB_AUTH_ERROR): TMDB auth error (401): ошибка авторизации внешнего сервиса TMDB.'
    );
  });

  it('returns localized session-expired message on HTTP 401 without TMDB_AUTH_ERROR', async () => {
    const response = new Response(
      JSON.stringify({ error: 'Unauthorized: valid Supabase session required.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const error = new FunctionsHttpError(response);

    const msg = await extractEdgeFunctionErrorMessage(error, 'Fallback error', response);
    expect(msg).toBe('Сессия истекла или недействительна (HTTP 401). Войдите в аккаунт заново.');
  });

  it('returns quota error details for HTTP 429 with QUOTA_EXCEEDED code', async () => {
    const response = new Response(
      JSON.stringify({
        error: 'Превышен лимит нераспознанных фильмов в профиле (максимум 5 000).',
        code: 'QUOTA_EXCEEDED',
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const error = new FunctionsHttpError(response);

    const msg = await extractEdgeFunctionErrorMessage(error, 'Fallback error', response);
    expect(msg).toBe('Превышен лимит нераспознанных фильмов в профиле (максимум 5 000). (HTTP 429)');
  });

  it('returns localized rate-limit message for generic HTTP 429', async () => {
    const response = new Response(
      JSON.stringify({ error: 'Too many batch requests. Please wait a minute and try again.' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const error = new FunctionsHttpError(response);

    const msg = await extractEdgeFunctionErrorMessage(error, 'Fallback error', response);
    expect(msg).toBe(
      'Слишком много запросов к TMDB-прокси (HTTP 429). Подождите минуту и повторите попытку.'
    );
  });

  it('returns localized timeout and resource-limit messages for HTTP 504 and HTTP 546', async () => {
    const res504 = new Response('', { status: 504 });
    const msg504 = await extractEdgeFunctionErrorMessage(
      new FunctionsHttpError(res504),
      'Fallback error',
      res504
    );
    expect(msg504).toBe('Превышено время ожидания Edge Function (HTTP 504). Попробуйте повторить.');

    const res546 = new Response('', { status: 546 });
    const msg546 = await extractEdgeFunctionErrorMessage(
      new FunctionsHttpError(res546),
      'Fallback error',
      res546
    );
    expect(msg546).toBe('Превышен лимит ресурсов Edge Function (HTTP 546). Попробуйте повторить.');
  });

  it('appends request_id when sb-request-id header is present', async () => {
    const response = new Response(JSON.stringify({ error: 'Internal server error in tmdb-proxy' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'sb-request-id': '01a1ff7c-427c-76cb-b006-376151fcee2a',
      },
    });
    const error = new FunctionsHttpError(response);

    const msg = await extractEdgeFunctionErrorMessage(error, 'Fallback error', response);
    expect(msg).toBe(
      'HTTP 500: Internal server error in tmdb-proxy (request_id: 01a1ff7c-427c-76cb-b006-376151fcee2a)'
    );
  });

  it('surfaces plain text bodies and falls back cleanly on HTML error pages', async () => {
    const textResponse = new Response('Upstream proxy error: connection reset', { status: 502 });
    const textMsg = await extractEdgeFunctionErrorMessage(
      new FunctionsHttpError(textResponse),
      'Fallback error',
      textResponse
    );
    expect(textMsg).toBe('HTTP 502: Upstream proxy error: connection reset');

    const htmlResponse = new Response('<!DOCTYPE html><html><body>502 Bad Gateway</body></html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    });
    const htmlMsg = await extractEdgeFunctionErrorMessage(
      new FunctionsHttpError(htmlResponse),
      'Fallback error',
      htmlResponse
    );
    expect(htmlMsg).toBe('Fallback error (HTTP 502)');
  });

  it('reads Response from error.context when explicit response argument is omitted', async () => {
    const response = new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
    const error = new FunctionsHttpError(response);

    const msg = await extractEdgeFunctionErrorMessage(error, 'Fallback error');
    expect(msg).toBe('HTTP 405: Method not allowed');
  });

  it('handles FunctionsFetchError, FunctionsRelayError, and unknown errors', async () => {
    const fetchErrWithCause = new FunctionsFetchError(new Error('Failed to fetch'));
    expect(await extractEdgeFunctionErrorMessage(fetchErrWithCause, 'Fallback error')).toBe(
      'Сетевая ошибка при обращении к Edge Function: Failed to fetch'
    );

    const fetchErrBare = new FunctionsFetchError({});
    expect(await extractEdgeFunctionErrorMessage(fetchErrBare, 'Fallback error')).toBe(
      'Сетевая ошибка при обращении к Edge Function. Проверьте подключение к интернету.'
    );

    const relayErr = new FunctionsRelayError(new Error('Relay unreachable'));
    expect(await extractEdgeFunctionErrorMessage(relayErr, 'Fallback error')).toBe(
      'Ошибка шлюза Supabase Edge Functions (Relay). Повторите попытку.'
    );

    expect(await extractEdgeFunctionErrorMessage(null, 'Fallback error')).toBe('Fallback error');
    expect(
      await extractEdgeFunctionErrorMessage(
        new Error('Edge Function returned a non-2xx status code'),
        'Fallback error'
      )
    ).toBe('Fallback error');
  });
});
