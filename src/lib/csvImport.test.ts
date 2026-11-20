import { describe, expect, it } from 'vitest';
import {
  annotateImportBatch,
  normalizeDateString,
  parseCsvContent,
  parseJsonImport,
  parseRussianTxtDiary,
  parsedRowsToLocalWatchEntries,
} from './csvImport';
import { computeTimeOfDayDistribution } from './analytics';
import type { WatchEntry } from '../types/cinelog';

describe('Smart CSV & Diary Import Pipeline', () => {
  it('parses Letterboxd diary CSV with quoted commas, half-stars, rewatch flag, and null watched_time', () => {
    const csv = [
      'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
      '2026-03-15,"Everything, Everywhere All at Once",2022,https://boxd.it/1,4.5,Yes,,2026-03-14',
      '2026-04-02,Dune: Part Two,2024,https://boxd.it/2,5,,imax,2026-04-02',
    ].join('\n');

    const rows = parseCsvContent(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe('csv_letterboxd');
    expect(rows[0].title).toBe('Everything, Everywhere All at Once');
    expect(rows[0].releaseYear).toBe(2022);
    expect(rows[0].watchedDate).toBe('2026-03-14');
    expect(rows[0].watchedTime).toBeNull();
    expect(rows[0].rating).toBe(4.5);
    expect(rows[0].isRewatch).toBe(true);

    expect(rows[1].isRewatch).toBe(false);
    expect(rows[1].rating).toBe(5);
  });

  it('parses IMDb ratings CSV, scales 10-point scores to 5-star half steps, and extracts metadata', () => {
    const csv = [
      'Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors',
      'tt0816692,9,2026-02-11,Interstellar,https://www.imdb.com/title/tt0816692/,movie,8.7,169,2014,"Adventure, Drama, Sci-Fi",2000000,2014-11-07,Christopher Nolan',
    ].join('\n');

    const rows = parseCsvContent(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('csv_imdb');
    expect(rows[0].imdbId).toBe('tt0816692');
    expect(rows[0].rating).toBe(4.5); // 9 / 2 = 4.5
    expect(rows[0].runtimeMinutes).toBe(169);
    expect(rows[0].genres).toEqual(['Adventure', 'Drama', 'Sci-Fi']);
    expect(rows[0].directors).toEqual(['Christopher Nolan']);
    expect(rows[0].watchedTime).toBeNull();
  });

  it('parses Russian .txt film diary with timestamps, range ratings, and rewatch flags', () => {
    const txt = [
      'Просмотренные фильмы 2024',
      '1. Inception (2010) - 23:30 5 января (8.5/10)',
      '2. The Matrix (1999) - 03:00 3 января (7-8/10) 🔁 Пересмотрел.',
    ].join('\n');

    const rows = parseRussianTxtDiary(txt);
    expect(rows).toHaveLength(2);
    expect(rows[0].watchedDate).toBe('2024-01-05');
    expect(rows[0].watchedTime).toBe('23:30:00');
    expect(rows[0].rating).toBe(4.5); // 8.5 / 2 = 4.25 -> 4.5
    expect(rows[0].isRewatch).toBe(false);

    expect(rows[1].watchedDate).toBe('2024-01-03');
    expect(rows[1].watchedTime).toBe('03:00:00');
    expect(rows[1].rating).toBe(4); // avg 7.5 / 2 = 3.75 -> 4.0
    expect(rows[1].isRewatch).toBe(true);
  });

  it('detects duplicates on same date and auto-flags rewatches on later dates', () => {
    const existing: WatchEntry[] = [
      {
        id: 'old-1',
        movie_id: 'm1',
        tmdb_id: null,
        imdb_id: null,
        title: 'Arrival',
        original_title: null,
        release_year: 2016,
        watched_date: '2025-05-10',
        watched_time: null,
        rating: 4.5,
        is_rewatch: false,
        source: 'csv_letterboxd',
        runtime_minutes: 116,
        runtime_override_minutes: null,
        genres: [],
        directors: [],
        countries: [],
        poster_url: null,
        import_key: null,
        created_at: '2025-05-10T00:00:00Z',
      },
    ];

    const csv = [
      'Name,Year,Watched Date,Rating',
      'Arrival,2016,2025-05-10,4.5', // exact duplicate -> skip
      'Arrival,2016,2026-06-01,5.0', // later date -> auto rewatch!
    ].join('\n');

    const annotated = annotateImportBatch(parseCsvContent(csv), existing);
    expect(annotated[0].isDuplicate).toBe(true);
    expect(annotated[1].isDuplicate).toBe(false);
    expect(annotated[1].isRewatch).toBe(true);
    expect(annotated[1].autoRewatchDetected).toBe(true);

    // Date-only CSV entries yield honest empty state for Time of Day chart
    const localEntries = parsedRowsToLocalWatchEntries(annotated);
    expect(localEntries).toHaveLength(1);
    const tod = computeTimeOfDayDistribution(localEntries, 2026);
    expect(tod.hasTimeData).toBe(false);
  });

  it('deduplicates re-imports against existing entries using original_title when TMDB localized title', () => {
    const existing: WatchEntry[] = [
      {
        id: 'old-localized-1',
        movie_id: 'm-poor-things',
        tmdb_id: 792307,
        imdb_id: null,
        title: 'Бедные-несчастные',
        original_title: 'Poor Things',
        release_year: 2023,
        watched_date: '2024-03-10',
        watched_time: '21:00:00',
        rating: 4.5,
        is_rewatch: false,
        source: 'txt_diary',
        runtime_minutes: 141,
        runtime_override_minutes: null,
        genres: ['Комедия', 'Драма'],
        directors: ['Yorgos Lanthimos'],
        countries: ['Великобритания'],
        poster_url: null,
        import_key: 'txt_diary:poor things:2023:2024-03-10:1',
        created_at: '2024-03-10T21:00:00Z',
      },
    ];

    const txt = [
      'Просмотренные фильмы 2024',
      '1. Poor things (2023) - 21:00 10 марта (9/10)',
      '2. Poor things (2023) - 20:00 15 мая (9/10)',
    ].join('\n');

    const annotated = annotateImportBatch(parseRussianTxtDiary(txt), existing);
    expect(annotated[0].isDuplicate).toBe(true);
    expect(annotated[1].isDuplicate).toBe(false);
    expect(annotated[1].isRewatch).toBe(true);
    expect(annotated[1].autoRewatchDetected).toBe(true);
  });

  it('handles prototype-like CSV header names safely without Object.prototype pollution', () => {
    const csv = [
      'Name,Year,Watched Date,__proto__,constructor,toString',
      'Inception,2010,2026-05-01,polluted,bad,override',
    ].join('\n');

    const rows = parseCsvContent(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Inception');
    expect(rows[0].releaseYear).toBe(2010);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects invalid calendar dates and validates JSON import fields strictly', () => {
    expect(normalizeDateString('2026-02-31')).toBeNull();
    expect(normalizeDateString('2025-02-29')).toBeNull();
    expect(normalizeDateString('2024-02-29')).toBe('2024-02-29');

    const json = JSON.stringify([
      null,
      'not-an-object',
      42,
      {
        title: 'Valid Movie',
        year: 2024,
        watched_date: '2026-04-10',
        watched_time: '99:99',
        source: 'malicious_source',
        tmdb_id: -5,
        imdb_id: 'invalid',
        runtime_minutes: 99999,
      },
      {
        title: 'Good Entry',
        release_year: 1999,
        watched_date: '2026-04-11',
        watched_time: '21:15',
        source: 'extension',
        tmdb_id: 603,
        imdb_id: 'tt0133093',
        runtime_minutes: 136,
      },
    ]);

    const rows = parseJsonImport(json);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Valid Movie');
    expect(rows[0].watchedTime).toBeNull();
    expect(rows[0].source).toBe('csv_letterboxd');
    expect(rows[0].tmdbId).toBeNull();
    expect(rows[0].imdbId).toBeNull();
    expect(rows[0].runtimeMinutes).toBeNull();

    expect(rows[1].title).toBe('Good Entry');
    expect(rows[1].watchedTime).toBe('21:15:00');
    expect(rows[1].source).toBe('extension');
    expect(rows[1].tmdbId).toBe(603);
    expect(rows[1].imdbId).toBe('tt0133093');
    expect(rows[1].runtimeMinutes).toBe(136);
  });
});
