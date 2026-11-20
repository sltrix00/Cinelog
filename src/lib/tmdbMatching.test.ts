import { describe, expect, it } from 'vitest';
import {
  buildSearchAttempts,
  localizeCountries,
  normalizeDirectors,
  normalizeGenres,
  normalizeTitleForComparison,
  pickBestCandidate,
} from '../../supabase/functions/tmdb-proxy/matching.ts';

describe('TMDB matching & metadata normalization', () => {
  it('normalizes yo/ye, punctuation, dashes, and Russian ordinal suffixes', () => {
    expect(normalizeTitleForComparison('Чёрный лебедь')).toBe(
      normalizeTitleForComparison('Черный лебедь')
    );
    expect(normalizeTitleForComparison('13-й район')).toBe(
      normalizeTitleForComparison('13 район')
    );
    expect(normalizeTitleForComparison('Мой парень — киллер')).toBe(
      normalizeTitleForComparison('Мой парень киллер')
    );
    expect(normalizeTitleForComparison('Adaptation.')).toBe('adaptation');
  });

  it('builds multi-step search attempts with language detection, yearless fallback, cleanup, and subtitle', () => {
    const ruAttempts = buildSearchAttempts('Ананасовый экспресс: сижу, курю', 2008);
    expect(ruAttempts[0]).toEqual({
      query: 'Ананасовый экспресс: сижу, курю',
      year: 2008,
      language: 'ru-RU',
    });
    expect(ruAttempts.some((a) => a.year === undefined && a.language === 'ru-RU')).toBe(true);
    expect(ruAttempts.some((a) => a.query === 'Ананасовый экспресс' && a.year === 2008)).toBe(true);
    expect(ruAttempts.some((a) => a.query === 'Ананасовый экспресс' && a.year === undefined)).toBe(true);
    expect(ruAttempts.some((a) => a.language === 'en-US')).toBe(true);

    const enAttempts = buildSearchAttempts('Adaptation.', 2002);
    expect(enAttempts[0]).toEqual({
      query: 'Adaptation.',
      year: 2002,
      language: 'en-US',
    });
    expect(enAttempts.some((a) => a.query === 'Adaptation' && a.year === 2002 && a.language === 'en-US')).toBe(true);
    expect(enAttempts.some((a) => a.query === 'Adaptation' && a.year === undefined && a.language === 'en-US')).toBe(true);
  });

  it('picks high-confidence exact match for "Престиж" (2006)', () => {
    const match = pickBestCandidate(
      [
        {
          id: 1124,
          title: 'Престиж',
          original_title: 'The Prestige',
          release_date: '2006-10-17',
          vote_count: 15800,
          popularity: 65,
        },
        {
          id: 999999,
          title: 'Престиж',
          original_title: 'Prestige',
          release_date: '1932-01-01',
          vote_count: 12,
          popularity: 1.5,
        },
      ],
      'Престиж',
      2006
    );

    expect(match).not.toBeNull();
    expect(match?.candidate.id).toBe(1124);
    expect(match?.highConfidence).toBe(true);
  });

  it('prefers popular animated feature for "9" (2009) over obscure shorts', () => {
    const match = pickBestCandidate(
      [
        {
          id: 777001,
          title: '9',
          original_title: '9',
          release_date: '2009-05-01',
          vote_count: 2,
          popularity: 0.6,
        },
        {
          id: 12244,
          title: 'Девять',
          original_title: '9',
          release_date: '2009-08-19',
          vote_count: 3700,
          popularity: 31,
        },
      ],
      '9',
      2009
    );

    expect(match?.candidate.id).toBe(12244);
    expect(match?.highConfidence).toBe(true);
  });

  it('recovers Sin City (2005) when diary lists "Город грехов" (2010)', () => {
    const match = pickBestCandidate(
      [
        {
          id: 187,
          title: 'Город грехов',
          original_title: 'Sin City',
          release_date: '2005-04-01',
          vote_count: 8100,
          popularity: 42,
        },
      ],
      'Город грехов',
      2010
    );

    expect(match).not.toBeNull();
    expect(match?.candidate.id).toBe(187);
    expect(match?.yearDiff).toBe(5);
  });

  it('matches "13 район" (2004) against "13-й район" (2004) and "La belle personne" via original_title', () => {
    const districtMatch = pickBestCandidate(
      [
        {
          id: 10045,
          title: '13-й район',
          original_title: 'Banlieue 13',
          release_date: '2004-11-10',
          vote_count: 1850,
          popularity: 22,
        },
      ],
      '13 район',
      2004
    );
    expect(districtMatch?.candidate.id).toBe(10045);
    expect(districtMatch?.titleScore).toBe(100);

    const frenchMatch = pickBestCandidate(
      [
        {
          id: 16268,
          title: 'Прекрасная смоковница',
          original_title: 'La Belle Personne',
          release_date: '2008-09-17',
          vote_count: 240,
          popularity: 9,
        },
      ],
      'La belle personne',
      2008
    );
    expect(frenchMatch?.candidate.id).toBe(16268);
    expect(frenchMatch?.highConfidence).toBe(true);
  });

  it('rejects false-positive matches with wrong title or large year mismatch', () => {
    const wrongTitle = pickBestCandidate(
      [
        {
          id: 500,
          title: 'Совершенно другой фильм',
          original_title: 'Completely Different Movie',
          release_date: '2019-01-01',
          vote_count: 1500,
          popularity: 20,
        },
      ],
      'Неизвестный артхаус',
      2019
    );
    expect(wrongTitle).toBeNull();

    const wrongYearAndPartialTitle = pickBestCandidate(
      [
        {
          id: 501,
          title: 'Переводчик судьбы',
          original_title: 'Destiny Translator',
          release_date: '2001-01-01',
          vote_count: 8,
          popularity: 1,
        },
      ],
      'Переводчик',
      2023
    );
    expect(wrongYearAndPartialTitle).toBeNull();
  });

  it('normalizes genres, localizes production countries, and deduplicates directors', () => {
    expect(normalizeGenres([{ name: 'драма' }, { name: 'Драма' }, { name: 'фантастика' }])).toEqual([
      'Драма',
      'Фантастика',
    ]);

    expect(
      localizeCountries([
        { iso_3166_1: 'US', name: 'United States of America' },
        { iso_3166_1: 'GB', name: 'United Kingdom' },
        { iso_3166_1: 'KR', name: 'South Korea' },
        { iso_3166_1: 'FR', name: 'France' },
        { iso_3166_1: 'JP', name: 'Japan' },
      ])
    ).toEqual(['США', 'Великобритания', 'Южная Корея', 'Франция', 'Япония']);

    expect(
      normalizeDirectors([
        { job: 'Producer', name: 'Emma Thomas' },
        { job: 'Director', name: 'Christopher Nolan' },
        { job: 'Director', name: 'Christopher Nolan' },
      ])
    ).toEqual(['Christopher Nolan']);
  });
});
