/**
 * Pure authentication helpers for redirect URLs, provider availability checks,
 * OAuth callback error parsing, and Russian error localization.
 */

export function isRepeatedSignupResponse(
  user: { identities?: unknown[] | null } | null | undefined
): boolean {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

export function getAuthRedirectUrl(
  loc: Pick<Location, 'origin' | 'pathname'> = window.location
): string {
  let pathname = (loc.pathname || '/').replace(/\/index\.html$/i, '/').replace(/^\/+/, '/');
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }
  if (!pathname.endsWith('/')) {
    pathname = `${pathname}/`;
  }
  return `${loc.origin}${pathname}`;
}

export function parseGoogleProviderEnabled(payload: unknown): boolean | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const external = (payload as { external?: unknown }).external;
  if (typeof external !== 'object' || external === null) {
    return null;
  }

  const google = (external as { google?: unknown }).google;
  return typeof google === 'boolean' ? google : null;
}

export function localizeAuthError(rawMessage: string): string {
  const trimmed = rawMessage.trim();
  const normalized = trimmed.toLowerCase();

  if (normalized.includes('provider is not enabled') || normalized.includes('unsupported provider')) {
    return 'Вход через Google ещё не включён в настройках Supabase (Authentication → Providers → Google). Пока войдите по email и паролю.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Неверный email или пароль.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Email ещё не подтверждён. Проверьте почту и перейдите по ссылке из письма.';
  }
  if (normalized.includes('user already registered')) {
    return 'Не удалось завершить регистрацию. Проверьте введённый email или попробуйте войти в аккаунт.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Пароль должен содержать минимум 6 символов.';
  }
  if (normalized.includes('rate limit')) {
    return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  }
  if (normalized.includes('new password should be different') || normalized.includes('same_password')) {
    return 'Новый пароль должен отличаться от текущего.';
  }
  if (normalized.includes('email link is invalid or has expired')) {
    return 'Ссылка из письма недействительна или уже была использована. Попробуйте войти в аккаунт или запросить письмо снова.';
  }
  if (normalized.includes('pkce') || normalized.includes('code verifier')) {
    return 'Не удалось завершить автоматический вход по ссылке. Если email уже подтверждён — войдите по email и паролю.';
  }

  return trimmed || 'Ошибка авторизации. Попробуйте ещё раз.';
}

export function parseAuthCallbackError(
  loc: Pick<Location, 'search' | 'hash'> = window.location
): string | null {
  const searchParams = new URLSearchParams(loc.search || '');
  const rawHash = (loc.hash || '').replace(/^#/, '');
  const hashParams = rawHash.includes('=') ? new URLSearchParams(rawHash) : null;

  const rawError =
    searchParams.get('error_description') ||
    hashParams?.get('error_description') ||
    searchParams.get('error') ||
    hashParams?.get('error') ||
    '';

  if (!rawError.trim()) {
    return null;
  }

  const sanitized = rawError
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  if (!sanitized) {
    return null;
  }

  const localized = localizeAuthError(sanitized);
  if (localized !== sanitized || /^[a-z0-9_]{2,40}$/.test(sanitized)) {
    return localized;
  }

  return 'Ошибка авторизации. Попробуйте ещё раз.';
}
