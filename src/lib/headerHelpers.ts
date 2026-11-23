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
