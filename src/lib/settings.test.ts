import { describe, expect, it } from 'vitest';
import { serializeWatchEntriesToCsv } from './exportData';
import {
  DEFAULT_USER_SETTINGS,
  THEMES,
  formatRatingBucketLabel,
  formatRatingShort,
  formatRatingValue,
  getThemeDefinition,
  sanitizeUserSettings,
} from './settings';
import type { WatchEntry } from '../types/cinelog';

describe('settings helpers', () => {
  it('provides 12 curated themes covering both dark and light modes', () => {
    expect(THEMES.length).toBe(12);
    expect(THEMES.filter((t) => t.mode === 'dark').length).toBeGreaterThanOrEqual(8);
    expect(THEMES.filter((t) => t.mode === 'light').length).toBeGreaterThanOrEqual(4);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  it('sanitizes invalid or partial stored settings safely', () => {
    expect(sanitizeUserSettings(null)).toEqual(DEFAULT_USER_SETTINGS);
    expect(
      sanitizeUserSettings({ theme: 'nonexistent', accent: 'nope', ratingFormat: 'invalid' })
    ).toEqual(DEFAULT_USER_SETTINGS);
    expect(
      sanitizeUserSettings({ theme: 'synthwave', accent: 'teal', ratingFormat: 'scale-10' })
    ).toEqual({
      theme: 'synthwave',
      accent: 'teal',
      ratingFormat: 'scale-10',
    });
  });

  it('falls back to midnight theme definition if unknown id is passed', () => {
    expect(getThemeDefinition('paper').mode).toBe('light');
    expect(getThemeDefinition('unknown' as never).id).toBe('midnight');
  });

  it('formats ratings consistently across 5-star, 10-point, and percent scales', () => {
    expect(formatRatingValue(4.5, 'stars-5')).toBe('4.5 ★');
    expect(formatRatingValue(4.5, 'scale-10')).toBe('9 / 10');
    expect(formatRatingValue(4.5, 'percent')).toBe('90%');

    expect(formatRatingShort(3.5, 'stars-5')).toBe('3.5★');
    expect(formatRatingShort(3.5, 'scale-10')).toBe('7/10');
    expect(formatRatingShort(3.5, 'percent')).toBe('70%');

    expect(formatRatingBucketLabel('4.5★', 'stars-5')).toBe('4.5★');
    expect(formatRatingBucketLabel('4.5★', 'scale-10')).toBe('9');
    expect(formatRatingBucketLabel('4.5★', 'percent')).toBe('90%');
  });
});

describe('serializeWatchEntriesToCsv', () => {
  it('escapes commas and quotes properly in CSV export', () => {
    const entry: WatchEntry = {
      id: 'w1',
      movie_id: 'm1',
      tmdb_id: 123,
      imdb_id: null,
      title: 'Hello, "Cinema"',
      original_title: null,
      release_year: 2025,
      watched_date: '2026-03-14',
      watched_time: '20:30:00',
      rating: 4.5,
      is_rewatch: true,
      source: 'manual',
      runtime_minutes: 118,
      runtime_override_minutes: null,
      genres: ['Драма', 'Триллер'],
      directors: ['Режиссёр'],
      countries: ['Франция'],
      poster_url: null,
      import_key: null,
      created_at: '2026-03-14T20:30:00Z',
    };

    const csv = serializeWatchEntriesToCsv([entry]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Title,Year,WatchedDate');
    expect(lines[1]).toContain('"Hello, ""Cinema""",2025,2026-03-14,20:30:00,4.5,Yes,118');
  });
});
