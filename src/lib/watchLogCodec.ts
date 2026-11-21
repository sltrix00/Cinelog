/**
 * Compact encoding/decoding helpers for `public.watch_logs` storage types:
 * - `watched_time_min`: smallint `0..1439` (minutes since midnight) <-> `'HH:MM:00'`
 * - `rating_x2`: smallint `1..10` (half-star units) <-> `0.5..5.0`
 * - `id`: sequential `bigint` serialized as decimal string
 */

export function timeStringToMinutes(time: string | null | undefined): number | null {
  if (typeof time !== 'string') return null;
  const trimmed = time.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function minutesToTimeString(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0 || minutes > 1439) {
    return null;
  }

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

export function ratingToHalfStars(rating: number | null | undefined): number | null {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 0.5 || rating > 5.0) {
    return null;
  }

  const scaled = Math.round(rating * 2);
  if (scaled < 1 || scaled > 10 || Math.abs(rating * 2 - scaled) >= 1e-6) {
    return null;
  }

  return scaled;
}

export function halfStarsToRating(ratingX2: number | null | undefined): number | null {
  if (typeof ratingX2 !== 'number' || !Number.isInteger(ratingX2) || ratingX2 < 1 || ratingX2 > 10) {
    return null;
  }

  return ratingX2 / 2;
}

export function isValidWatchLogId(id: string): boolean {
  return typeof id === 'string' && /^\d+$/.test(id.trim());
}
