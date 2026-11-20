import { describe, expect, it } from 'vitest';
import {
  getAuthRedirectUrl,
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
  });
});
