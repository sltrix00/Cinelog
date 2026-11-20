import { describe, expect, it } from 'vitest';
import {
  annotateImportBatch,
  parseCsvContent,
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
});
