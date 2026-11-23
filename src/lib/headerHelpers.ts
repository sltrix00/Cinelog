import type { YearFilter } from '../types/cinelog';

export function resolveProfileNickname(
  profile: { username?: string | null } | null,
  userMetadata?: Record<string, unknown> | null
): string | null {
  if (profile !== null) {
    const trimmed = profile.username?.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof userMetadata?.username === 'string') {
    const trimmed = userMetadata.username.trim();
    return trimmed ? trimmed : null;
  }

  return null;
}

export function formatAccountButtonLabel(
  userEmail: string | null,
  userNickname: string | null
): string {
  if (!userEmail) return 'Войти';
  const trimmed = userNickname?.trim();
  return trimmed ? trimmed : 'Профиль';
}

export function formatYearFilterLabel(selectedYear: YearFilter): string {
  return selectedYear === 'all' ? 'Все время' : String(selectedYear);
}

export function sortYearsDesc(years: number[]): number[] {
  const unique = new Set<number>();
  for (const year of years) {
    if (Number.isInteger(year) && year >= 1888 && year <= 2100) {
      unique.add(year);
    }
  }
  return Array.from(unique).sort((a, b) => b - a);
}

export function formatDashboardSubtitle(
  isDemoMode: boolean,
  userNickname: string | null
): string {
  if (isDemoMode) {
    return 'Интерактивная статистика по архиву 2024–2026 годов (Demo Mode)';
  }
  const trimmed = userNickname?.trim();
  return trimmed ? `Персональный облачный журнал · ${trimmed}` : 'Персональный облачный журнал';
}

export function validateNicknameInput(raw: string): {
  valid: boolean;
  normalized: string | null;
  error: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true, normalized: null, error: null };
  }
  if (trimmed.length < 3) {
    return { valid: false, normalized: null, error: 'Минимум 3 символа.' };
  }
  if (trimmed.length > 32) {
    return { valid: false, normalized: null, error: 'Максимум 32 символа.' };
  }
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(trimmed)) {
    return {
      valid: false,
      normalized: null,
      error: 'Допустимы только латинские буквы, цифры, _, . и -.',
    };
  }
  return { valid: true, normalized: trimmed, error: null };
}

export function maskEmailAsPassword(email: string): string {
  return '•'.repeat(Math.min(Math.max(email.length, 10), 20));
}

export function getProfileInitials(nickname: string | null): string | null {
  const trimmed = nickname?.trim();
  if (!trimmed) return null;
  const alnum = trimmed.replace(/[^A-Za-z0-9А-Яа-яЁё]/g, '');
  const source = alnum || trimmed;
  return source.slice(0, 2).toUpperCase();
}
