import { describe, expect, it } from 'vitest';
import {
  createIsolatedAuthStorage,
  getAuthRedirectUrl,
  isRepeatedSignupResponse,
  localizeAuthError,
  parseAuthCallbackError,
  parseGoogleProviderEnabled,
} from './authHelpers';

describe('getAuthRedirectUrl', () => {
  it('preserves GitHub Pages subpath with trailing slash', () => {
    expect(
      getAuthRedirectUrl({
        origin: 'https://sltrix00.github.io',
        pathname: '/MovieTracker2/',
      })
    ).toBe('https://sltrix00.github.io/MovieTracker2/');
  });

  it('appends trailing slash when GitHub Pages subpath omits it', () => {
    expect(
      getAuthRedirectUrl({
        origin: 'https://sltrix00.github.io',
        pathname: '/MovieTracker2',
      })
    ).toBe('https://sltrix00.github.io/MovieTracker2/');
  });

  it('strips index.html while keeping the base path', () => {
    expect(
      getAuthRedirectUrl({
        origin: 'https://sltrix00.github.io',
        pathname: '/MovieTracker2/index.html',
      })
    ).toBe('https://sltrix00.github.io/MovieTracker2/');
  });

  it('normalizes localhost root path', () => {
    expect(
      getAuthRedirectUrl({
        origin: 'http://localhost:5173',
        pathname: '/',
      })
    ).toBe('http://localhost:5173/');

    expect(
      getAuthRedirectUrl({
        origin: 'http://localhost:5173',
        pathname: '/index.html',
      })
    ).toBe('http://localhost:5173/');
  });

  it('collapses multiple leading slashes so scheme-relative paths cannot form', () => {
    expect(
      getAuthRedirectUrl({
        origin: 'https://sltrix00.github.io',
        pathname: '//evil.example/MovieTracker2',
      })
    ).toBe('https://sltrix00.github.io/evil.example/MovieTracker2/');
  });
});

describe('parseGoogleProviderEnabled', () => {
  it('returns boolean value when external.google is present', () => {
    expect(parseGoogleProviderEnabled({ external: { google: true } })).toBe(true);
    expect(parseGoogleProviderEnabled({ external: { google: false } })).toBe(false);
  });

  it('returns null for missing or malformed payloads', () => {
    expect(parseGoogleProviderEnabled(null)).toBeNull();
    expect(parseGoogleProviderEnabled(undefined)).toBeNull();
    expect(parseGoogleProviderEnabled('invalid')).toBeNull();
    expect(parseGoogleProviderEnabled({})).toBeNull();
    expect(parseGoogleProviderEnabled({ external: null })).toBeNull();
    expect(parseGoogleProviderEnabled({ external: { google: 'true' } })).toBeNull();
  });
});

describe('localizeAuthError', () => {
  it('translates common Supabase Auth errors into Russian', () => {
    expect(localizeAuthError('Unsupported provider: provider is not enabled')).toContain(
      'Вход через Google ещё не включён'
    );
    expect(localizeAuthError('Invalid login credentials')).toBe('Неверный email или пароль.');
    expect(localizeAuthError('User already registered')).toBe(
      'Не удалось завершить регистрацию. Проверьте введённый email или попробуйте войти в аккаунт.'
    );
    expect(localizeAuthError('Email not confirmed')).toContain('Email ещё не подтверждён');
    expect(localizeAuthError('Password should be at least 6 characters')).toContain(
      'минимум 6 символов'
    );
    expect(localizeAuthError('Email rate limit exceeded')).toContain('Слишком много попыток');
    expect(localizeAuthError('New password should be different from the old password.')).toContain(
      'должен отличаться от текущего'
    );
  });

  it('returns unknown messages trimmed or fallback text for empty input', () => {
    expect(localizeAuthError('  Custom gateway timeout  ')).toBe('Custom gateway timeout');
    expect(localizeAuthError('   ')).toBe('Ошибка авторизации. Попробуйте ещё раз.');
  });
});

describe('parseAuthCallbackError', () => {
  it('parses and localizes errors from query parameters', () => {
    expect(
      parseAuthCallbackError({
        search: '?error=access_denied&error_description=Unsupported+provider%3A+provider+is+not+enabled',
        hash: '',
      })
    ).toContain('Вход через Google ещё не включён');

    expect(
      parseAuthCallbackError({
        search: '?error=access_denied',
        hash: '',
      })
    ).toBe('access_denied');
  });

  it('parses and localizes errors from OAuth hash fragment', () => {
    expect(
      parseAuthCallbackError({
        search: '',
        hash: '#error=server_error&error_description=Invalid+login+credentials',
      })
    ).toBe('Неверный email или пароль.');
  });

  it('ignores normal in-page anchor hashes', () => {
    expect(
      parseAuthCallbackError({
        search: '',
        hash: '#level-1',
      })
    ).toBeNull();

    expect(
      parseAuthCallbackError({
        search: '',
        hash: '#journal',
      })
    ).toBeNull();
  });

  it('blocks arbitrary phishing text in callback error_description while allowing known OAuth codes', () => {
    const res = parseAuthCallbackError({
      search: '?error_description=Visit+https%3A%2F%2Fevil.example%2Flogin+<script>alert(1)</script>',
      hash: '',
    });
    expect(res).toBe('Ошибка авторизации. Попробуйте ещё раз.');
    expect(
      parseAuthCallbackError({
        search: '?error=otp_expired',
        hash: '',
      })
    ).toBe('otp_expired');
    expect(
      parseAuthCallbackError({
        search:
          '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
        hash: '',
      })
    ).toContain('Ссылка из письма недействительна или уже была использована');
  });
});

function createMemoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

describe('isRepeatedSignupResponse', () => {
  it('detects obfuscated existing-user signup responses with empty identities', () => {
    expect(isRepeatedSignupResponse({ identities: [] })).toBe(true);
    expect(isRepeatedSignupResponse({ identities: [{ id: '1' }] })).toBe(false);
    expect(isRepeatedSignupResponse({ identities: undefined })).toBe(false);
    expect(isRepeatedSignupResponse({ identities: null })).toBe(false);
    expect(isRepeatedSignupResponse(null)).toBe(false);
    expect(isRepeatedSignupResponse(undefined)).toBe(false);
  });
});

describe('localizeAuthError PKCE and expired link handling', () => {
  it('localizes expired email links and missing PKCE code verifier errors', () => {
    expect(localizeAuthError('Email link is invalid or has expired')).toContain(
      'Ссылка из письма недействительна или уже была использована'
    );
    expect(localizeAuthError('PKCE code verifier not found in storage.')).toContain(
      'Не удалось завершить автоматический вход по ссылке'
    );
  });
});

describe('createIsolatedAuthStorage', () => {
  it('isolates session tokens to sessionStorage and purges residual localStorage session tokens', () => {
    const sessionStorage = createMemoryStorage();
    const localStorage = createMemoryStorage({
      'sb-proj-auth-token': '{"access_token":"stale"}',
      'unrelated-key': 'keep-me',
    });

    const storage = createIsolatedAuthStorage({ sessionStorage, localStorage })!;
    expect(localStorage.getItem('sb-proj-auth-token')).toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me');

    storage.setItem('sb-proj-auth-token', '{"access_token":"fresh"}');
    expect(sessionStorage.getItem('sb-proj-auth-token')).toBe('{"access_token":"fresh"}');
    expect(localStorage.getItem('sb-proj-auth-token')).toBeNull();
    expect(storage.getItem('sb-proj-auth-token')).toBe('{"access_token":"fresh"}');
  });

  it('persists PKCE code verifiers across browser tabs without deleting them on read', () => {
    const tab1Session = createMemoryStorage();
    const sharedLocal = createMemoryStorage();
    const tab1Storage = createIsolatedAuthStorage({
      sessionStorage: tab1Session,
      localStorage: sharedLocal,
    })!;

    tab1Storage.setItem('sb-proj-auth-token-code-verifier', 'verifier-1');
    tab1Storage.setItem('sb-proj-auth-token-flow-123-code-verifier', 'verifier-slot-123');
    expect(sharedLocal.getItem('sb-proj-auth-token-code-verifier')).toBe('verifier-1');
    expect(sharedLocal.getItem('sb-proj-auth-token-flow-123-code-verifier')).toBe(
      'verifier-slot-123'
    );

    // Confirmation link opens in a new tab with an empty sessionStorage
    const tab2Session = createMemoryStorage();
    const tab2Storage = createIsolatedAuthStorage({
      sessionStorage: tab2Session,
      localStorage: sharedLocal,
    })!;

    // GoTrueClient reads the verifier twice (_isPKCECallback + _exchangeCodeForSession)
    expect(tab2Storage.getItem('sb-proj-auth-token-code-verifier')).toBe('verifier-1');
    expect(tab2Storage.getItem('sb-proj-auth-token-code-verifier')).toBe('verifier-1');
    expect(tab2Storage.getItem('sb-proj-auth-token-flow-123-code-verifier')).toBe(
      'verifier-slot-123'
    );
    expect(tab2Storage.getItem('sb-proj-auth-token-flow-123-code-verifier')).toBe(
      'verifier-slot-123'
    );

    tab2Storage.removeItem('sb-proj-auth-token-code-verifier');
    tab2Storage.removeItem('sb-proj-auth-token-flow-123-code-verifier');
    expect(sharedLocal.getItem('sb-proj-auth-token-code-verifier')).toBeNull();
    expect(tab2Session.getItem('sb-proj-auth-token-code-verifier')).toBeNull();
    expect(tab2Storage.getItem('sb-proj-auth-token-code-verifier')).toBeNull();
    expect(tab2Storage.getItem('sb-proj-auth-token-flow-123-code-verifier')).toBeNull();

    // Same-tab removal also clears tab1's sessionStorage copy
    tab1Storage.removeItem('sb-proj-auth-token-code-verifier');
    tab1Storage.removeItem('sb-proj-auth-token-flow-123-code-verifier');
    expect(tab1Session.getItem('sb-proj-auth-token-code-verifier')).toBeNull();
    expect(tab1Session.getItem('sb-proj-auth-token-flow-123-code-verifier')).toBeNull();
  });
});
