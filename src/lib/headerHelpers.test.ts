import { describe, expect, it } from 'vitest';
import {
  formatAccountButtonLabel,
  formatDashboardSubtitle,
  formatYearFilterLabel,
  getProfileInitials,
  maskEmailAsPassword,
  resolveProfileNickname,
  sortYearsDesc,
  validateNicknameInput,
} from './headerHelpers';

describe('resolveProfileNickname', () => {
  it('returns trimmed username when profile contains a nickname', () => {
    expect(
      resolveProfileNickname(
        { username: '  cinephile_2026  ' },
        { full_name: 'John Doe', username: 'ignored_meta' }
      )
    ).toBe('cinephile_2026');
  });

  it('returns null when profile exists with null or whitespace username, ignoring full_name', () => {
    expect(
      resolveProfileNickname(
        { username: null },
        { full_name: 'Google User', name: 'Google User', email: 'user@example.com' }
      )
    ).toBeNull();
    expect(
      resolveProfileNickname({ username: '   ' }, { full_name: 'Google User' })
    ).toBeNull();
  });

  it('falls back to user_metadata.username only when profile is null', () => {
    expect(
      resolveProfileNickname(null, { username: ' meta_nick ', full_name: 'Google User' })
    ).toBe('meta_nick');
    expect(
      resolveProfileNickname(null, { full_name: 'Google User', username: '   ' })
    ).toBeNull();
    expect(resolveProfileNickname(null, undefined)).toBeNull();
  });
});

describe('formatAccountButtonLabel', () => {
  it('returns Войти when signed out', () => {
    expect(formatAccountButtonLabel(null, null)).toBe('Войти');
    expect(formatAccountButtonLabel(null, 'ignored')).toBe('Войти');
  });

  it('returns Профиль when signed in without nickname', () => {
    expect(formatAccountButtonLabel('viewer@example.com', null)).toBe('Профиль');
    expect(formatAccountButtonLabel('viewer@example.com', '   ')).toBe('Профиль');
  });

  it('returns trimmed nickname when signed in with nickname', () => {
    expect(formatAccountButtonLabel('viewer@example.com', '  kino_fan  ')).toBe('kino_fan');
  });
});

describe('formatYearFilterLabel', () => {
  it('returns Все время for all and numeric string for years', () => {
    expect(formatYearFilterLabel('all')).toBe('Все время');
    expect(formatYearFilterLabel(2026)).toBe('2026');
    expect(formatYearFilterLabel(2024)).toBe('2024');
  });
});

describe('sortYearsDesc', () => {
  it('deduplicates, filters invalid years, and sorts descending', () => {
    expect(sortYearsDesc([2024, 2026, 2025, 2026, 1800, 2200, Number.NaN])).toEqual([
      2026,
      2025,
      2024,
    ]);
  });
});

describe('formatDashboardSubtitle', () => {
  it('returns demo subtitle in demo mode regardless of nickname', () => {
    expect(formatDashboardSubtitle(true, 'olzhas')).toBe(
      'Интерактивная статистика по архиву 2024–2026 годов (Demo Mode)'
    );
  });

  it('omits email and leaves only base text when user has no nickname', () => {
    expect(formatDashboardSubtitle(false, null)).toBe('Персональный облачный журнал');
    expect(formatDashboardSubtitle(false, '   ')).toBe('Персональный облачный журнал');
  });

  it('appends trimmed nickname when set', () => {
    expect(formatDashboardSubtitle(false, '  cine_fan  ')).toBe(
      'Персональный облачный журнал · cine_fan'
    );
  });
});

describe('validateNicknameInput', () => {
  it('allows empty/whitespace input to clear nickname', () => {
    expect(validateNicknameInput('')).toEqual({ valid: true, normalized: null, error: null });
    expect(validateNicknameInput('   ')).toEqual({ valid: true, normalized: null, error: null });
  });

  it('rejects too short, too long, or invalid characters', () => {
    expect(validateNicknameInput('ab')).toEqual({
      valid: false,
      normalized: null,
      error: 'Минимум 3 символа.',
    });
    expect(validateNicknameInput('a'.repeat(33))).toEqual({
      valid: false,
      normalized: null,
      error: 'Максимум 32 символа.',
    });
    expect(validateNicknameInput('имя_юзера')).toEqual({
      valid: false,
      normalized: null,
      error: 'Допустимы только латинские буквы, цифры, _, . и -.',
    });
    expect(validateNicknameInput('bad nick')).toEqual({
      valid: false,
      normalized: null,
      error: 'Допустимы только латинские буквы, цифры, _, . и -.',
    });
  });

  it('accepts valid trimmed nicknames', () => {
    expect(validateNicknameInput('  Olzhas_01.film-club  ')).toEqual({
      valid: true,
      normalized: 'Olzhas_01.film-club',
      error: null,
    });
  });
});

describe('maskEmailAsPassword', () => {
  it('masks emails with bullet characters bounded between 10 and 20 chars', () => {
    expect(maskEmailAsPassword('a@b.c')).toBe('•'.repeat(10));
    expect(maskEmailAsPassword('user@example.com')).toBe('•'.repeat(16));
    expect(maskEmailAsPassword('very.long.email.address@example.com')).toBe('•'.repeat(20));
  });
});

describe('getProfileInitials', () => {
  it('returns null when nickname is empty', () => {
    expect(getProfileInitials(null)).toBeNull();
    expect(getProfileInitials('   ')).toBeNull();
  });

  it('extracts up to 2 uppercase alphanumeric characters', () => {
    expect(getProfileInitials('olzhas_26')).toBe('OL');
    expect(getProfileInitials('__ab')).toBe('AB');
    expect(getProfileInitials('...')).toBe('..');
  });
});
