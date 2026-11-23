import { describe, expect, it } from 'vitest';
import {
  formatAccountButtonLabel,
  formatYearFilterLabel,
  resolveProfileNickname,
  sortYearsDesc,
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
