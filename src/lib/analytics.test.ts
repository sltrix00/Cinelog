import { describe, expect, it } from 'vitest';
import {
  computeActivityHeatmap,
  computeCumulativeComparison365,
  computeDayOfWeekDistribution,
  computeMonthlyByYear,
  computeRatingsAnalytics,
  computeReleaseEras,
  computeRuntimeAnalytics,
  computeTasteAccents,
  computeTier1KPIs,
  computeTimeOfDayDistribution,
  computeViewingIndexTrajectory,
  DEFAULT_REFERENCE_DATE,
  extractAvailableYears,
  filmWord,
  filterEntriesByYear,
  getDayOfYear,
  resolveComparisonYears,
  rewatchWord,
  timeStringToBucket,
} from './analytics';
import { DEMO_ENTRIES } from './demoData';
import type { WatchEntry } from '../types/cinelog';

function makeCsvOnlyEntry(overrides: Partial<WatchEntry>): WatchEntry {
  return {
    id: 'csv-1',
    movie_id: 'm-1',
    tmdb_id: null,
    imdb_id: null,
    title: 'Stalker',
    original_title: null,
    release_year: 1979,
    watched_date: '2026-05-10',
    watched_time: null,
    rating: 5.0,
    is_rewatch: false,
    source: 'csv_letterboxd',
    runtime_minutes: 162,
    runtime_override_minutes: null,
    genres: ['Sci-Fi', 'Drama'],
    directors: ['Andrei Tarkovsky'],
    countries: ['Soviet Union'],
    poster_url: null,
    import_key: 'csv:1',
    created_at: '2026-05-10T00:00:00Z',
    ...overrides,
  };
}

describe('Demo Dataset Parity (cinelog.html)', () => {
  it('matches exact totals across 2024, 2025, and 2026', () => {
    const kpis2026 = computeTier1KPIs(DEMO_ENTRIES, 2026, DEFAULT_REFERENCE_DATE);
    expect(kpis2026.allTimeTotal).toBe(314);
    expect(kpis2026.allTimeUnique).toBe(298);
    expect(kpis2026.yearTotal).toBe(122);
    expect(kpis2026.yearRewatches).toBe(14);
    expect(kpis2026.yearNewCount).toBe(108);
    expect(kpis2026.monthTotal).toBe(6);
    expect(kpis2026.monthRewatches).toBe(1);
    expect(kpis2026.weekTotal).toBe(3);
    expect(kpis2026.weekRewatches).toBe(0);

    // Viewing Index: 122 / 324 = 0.3765 -> 0.38, forecast ~137
    expect(kpis2026.daysElapsedYear).toBe(324);
    expect(kpis2026.yearIndex.toFixed(2)).toBe('0.38');
    expect(kpis2026.yearProjection).toBe(137);
    expect(kpis2026.monthDaysElapsed).toBe(20);
    expect(kpis2026.monthIndex.toFixed(2)).toBe('0.30');
    expect(kpis2026.isMonthAboveYearPace).toBe(false);

    const kpis2025 = computeTier1KPIs(DEMO_ENTRIES, 2025, DEFAULT_REFERENCE_DATE);
    expect(kpis2025.yearTotal).toBe(108);
    expect(kpis2025.yearRewatches).toBe(21);

    const kpis2024 = computeTier1KPIs(DEMO_ENTRIES, 2024, DEFAULT_REFERENCE_DATE);
    expect(kpis2024.yearTotal).toBe(84);
    expect(kpis2024.yearRewatches).toBe(8);
  });

  it('produces exact monthly, day-of-week, time-of-day, rating, and runtime numbers', () => {
    const monthly = computeMonthlyByYear(DEMO_ENTRIES);
    expect(monthly.map((m) => m.y2024)).toEqual([8, 6, 7, 7, 9, 5, 7, 7, 7, 7, 7, 7]);
    expect(monthly.map((m) => m.y2025)).toEqual([9, 10, 7, 10, 7, 7, 12, 10, 6, 11, 8, 11]);
    expect(monthly.map((m) => m.y2026)).toEqual([14, 11, 10, 10, 14, 9, 12, 11, 12, 13, 6, 0]);

    const dow2026 = computeDayOfWeekDistribution(DEMO_ENTRIES, 2026);
    expect(dow2026.points.map((p) => p.count)).toEqual([17, 13, 14, 19, 23, 17, 19]);
    expect(dow2026.peakLabel).toBe('Пт');
    expect(dow2026.peakCount).toBe(23);

    const tod2026 = computeTimeOfDayDistribution(DEMO_ENTRIES, 2026);
    expect(tod2026.hasTimeData).toBe(true);
    expect(tod2026.points.map((p) => p.count)).toEqual([9, 22, 63, 28]);

    const ratings2026 = computeRatingsAnalytics(DEMO_ENTRIES, 2026);
    expect(ratings2026.averageRating.toFixed(2)).toBe('3.67');

    const runtime2026 = computeRuntimeAnalytics(DEMO_ENTRIES, 2026);
    expect(runtime2026.totalMinutes).toBe(16857);
    expect(runtime2026.totalHours).toBe(281);
    expect(runtime2026.totalDays).toBe('11.7');
  });
});

describe('Viewing Index, Cumulative 365 & Edge Cases', () => {
  it('computes Viewing Index 1.00 when 100 films watched on day 100', () => {
    const entries: WatchEntry[] = Array.from({ length: 100 }, (_, i) =>
      makeCsvOnlyEntry({
        id: `e-${i}`,
        watched_date: '2026-04-10', // Day 100
      })
    );
    const kpis = computeTier1KPIs(entries, 2026, {
      year: 2026,
      monthIndex: 3,
      day: 10,
      dayOfYear: 100,
    });
    expect(kpis.yearIndex).toBe(1);
    expect(kpis.yearIndex.toFixed(2)).toBe('1.00');
  });

  it('maintains a flat horizontal plateau in 2026 after day 324 and computes YoY delta', () => {
    const cum = computeCumulativeComparison365(DEMO_ENTRIES);
    expect(cum).toHaveLength(365);
    expect(cum[323].doy).toBe(324);
    expect(cum[323].y2026).toBe(122);
    expect(cum[364].y2026).toBe(122); // Flat plateau through Dec 31
    expect(cum[323].yoyDelta26vs25).toBe(cum[323].y2026 - cum[323].y2025);

    const trajectory = computeViewingIndexTrajectory(DEMO_ENTRIES, 2026, DEFAULT_REFERENCE_DATE);
    expect(trajectory[trajectory.length - 1].doy).toBe(324);
    expect(trajectory[trajectory.length - 1].index).toBe(0.38);
  });

  it('returns honest empty state when all entries have watched_time === null (CSV imports)', () => {
    const csvOnly = [
      makeCsvOnlyEntry({ id: '1', watched_date: '2026-01-05', watched_time: null }),
      makeCsvOnlyEntry({ id: '2', watched_date: '2026-02-06', watched_time: null }),
    ];
    const tod = computeTimeOfDayDistribution(csvOnly, 2026);
    expect(tod.hasTimeData).toBe(false);
    expect(tod.totalWithTime).toBe(0);
    expect(tod.points.every((p) => p.count === 0)).toBe(true);
  });

  it('calculates heatmap active days, max streak, eras, and taste accents accurately', () => {
    const entries = [
      makeCsvOnlyEntry({ id: '1', watched_date: '2026-01-01', release_year: 1979, directors: ['Tarkovsky'] }),
      makeCsvOnlyEntry({ id: '2', watched_date: '2026-01-02', release_year: 2019, directors: ['Bong Joon-ho'] }),
      makeCsvOnlyEntry({ id: '3', watched_date: '2026-01-03', release_year: 2024, directors: ['Tarkovsky'] }),
      makeCsvOnlyEntry({ id: '4', watched_date: '2026-01-03', release_year: 1995, directors: ['Fincher'] }),
    ];

    const heatmap = computeActivityHeatmap(entries, 2026, DEFAULT_REFERENCE_DATE);
    expect(heatmap.activeDays).toBe(3);
    expect(heatmap.maxStreak).toBe(3);
    expect(heatmap.maxCount).toBe(2);
    expect(heatmap.cells[0].intensity).toBe(2);
    expect(heatmap.cells[2].count).toBe(2);
    expect(heatmap.cells[2].intensity).toBe(4);
    expect(heatmap.cells[3].intensity).toBe(0);

    const eras = computeReleaseEras(entries, 2026);
    expect(eras.classicCount).toBe(2);
    expect(eras.classicSharePct).toBe(50);

    const directors = computeTasteAccents(entries, 2026, 'directors');
    expect(directors[0].name).toBe('Tarkovsky');
    expect(directors[0].count).toBe(2);
    expect(directors[0].pct).toBe(100);
    expect(directors[0].barPct).toBe(100);
    expect(directors[0].shareOfTotalPct).toBe(50);
  });

  it('scales heatmap intensity adaptively across 5 levels (0..4)', () => {
    const entries = [
      makeCsvOnlyEntry({ id: 'a1', watched_date: '2026-01-01' }),
      makeCsvOnlyEntry({ id: 'b1', watched_date: '2026-01-02' }),
      makeCsvOnlyEntry({ id: 'b2', watched_date: '2026-01-02' }),
      makeCsvOnlyEntry({ id: 'c1', watched_date: '2026-01-03' }),
      makeCsvOnlyEntry({ id: 'c2', watched_date: '2026-01-03' }),
      makeCsvOnlyEntry({ id: 'c3', watched_date: '2026-01-03' }),
      makeCsvOnlyEntry({ id: 'd1', watched_date: '2026-01-04' }),
      makeCsvOnlyEntry({ id: 'd2', watched_date: '2026-01-04' }),
      makeCsvOnlyEntry({ id: 'd3', watched_date: '2026-01-04' }),
      makeCsvOnlyEntry({ id: 'd4', watched_date: '2026-01-04' }),
      makeCsvOnlyEntry({ id: 'e1', watched_date: '2026-01-05' }),
      makeCsvOnlyEntry({ id: 'e2', watched_date: '2026-01-05' }),
      makeCsvOnlyEntry({ id: 'e3', watched_date: '2026-01-05' }),
      makeCsvOnlyEntry({ id: 'e4', watched_date: '2026-01-05' }),
      makeCsvOnlyEntry({ id: 'e5', watched_date: '2026-01-05' }),
    ];

    const heatmap = computeActivityHeatmap(entries, 2026, DEFAULT_REFERENCE_DATE);
    expect(heatmap.maxCount).toBe(5);
    expect(heatmap.cells[0].intensity).toBe(1); // 1/5
    expect(heatmap.cells[1].intensity).toBe(2); // 2/5
    expect(heatmap.cells[2].intensity).toBe(3); // 3/5
    expect(heatmap.cells[3].intensity).toBe(4); // 4/5
    expect(heatmap.cells[4].intensity).toBe(4); // 5/5
    expect(heatmap.cells[5].intensity).toBe(0); // 0/5
  });

  it('handles DST-safe dayOfYear, timeStringToBucket, and Russian pluralization', () => {
    expect(getDayOfYear('2026-01-01')).toBe(1);
    expect(getDayOfYear('2026-11-20')).toBe(324);
    expect(getDayOfYear('2026-12-31')).toBe(365);

    expect(timeStringToBucket('08:15:00')).toBe(0);
    expect(timeStringToBucket('14:00:00')).toBe(1);
    expect(timeStringToBucket('21:30:00')).toBe(2);
    expect(timeStringToBucket('01:10:00')).toBe(3);
    expect(timeStringToBucket(null)).toBeNull();

    expect(filmWord(1)).toBe('фильм');
    expect(filmWord(2)).toBe('фильма');
    expect(filmWord(5)).toBe('фильмов');
    expect(filmWord(11)).toBe('фильмов');
    expect(rewatchWord(1)).toBe('пересмотр');
    expect(rewatchWord(3)).toBe('пересмотра');
    expect(rewatchWord(14)).toBe('пересмотров');
  });

  it('extracts available years sorted ascending and filters non-2024..2026 years', () => {
    const entries = [
      makeCsvOnlyEntry({ id: '1', watched_date: '2021-03-14' }),
      makeCsvOnlyEntry({ id: '2', watched_date: '2027-01-09' }),
      makeCsvOnlyEntry({ id: '3', watched_date: '2021-11-02' }),
    ];

    expect(extractAvailableYears(entries)).toEqual([2021, 2024, 2025, 2026, 2027]);
    const filtered2021 = filterEntriesByYear(entries, 2021);
    expect(filtered2021).toHaveLength(2);
    expect(filtered2021.map((e) => e.id)).toEqual(['1', '3']);
  });

  it('aggregates all years into a single 365-day heatmap with chronological streaks when selectedYear is all', () => {
    const entries = [
      makeCsvOnlyEntry({ id: '1', watched_date: '2024-01-01', title: 'Film A' }),
      makeCsvOnlyEntry({ id: '2', watched_date: '2025-01-01', title: 'Film B' }),
      makeCsvOnlyEntry({ id: '3', watched_date: '2026-01-02', title: 'Film C' }),
      makeCsvOnlyEntry({ id: '4', watched_date: '2024-12-25', title: 'Film D' }),
      makeCsvOnlyEntry({ id: '5', watched_date: '2024-12-31', title: 'Film E' }),
    ];

    const heatmapAll = computeActivityHeatmap(entries, 'all', DEFAULT_REFERENCE_DATE);
    expect(heatmapAll.year).toBe('all');
    expect(heatmapAll.cells).toHaveLength(365);
    expect(heatmapAll.cells[0].count).toBe(2);
    expect(heatmapAll.cells[0].titles).toEqual(['Film A (2024)', 'Film B (2025)']);
    expect(heatmapAll.foldedActiveDays).toBe(4);
    expect(heatmapAll.activeDays).toBe(5);
    expect(heatmapAll.maxStreak).toBe(2); // 2024-12-31 -> 2025-01-01 chronological streak
    expect(heatmapAll.cells.every((c) => !c.isFuture)).toBe(true);
  });

  it('resolves dynamic comparison years for historical imported datasets', () => {
    const historical = [
      makeCsvOnlyEntry({ id: '1', watched_date: '2019-03-10' }),
      makeCsvOnlyEntry({ id: '2', watched_date: '2020-07-12' }),
      makeCsvOnlyEntry({ id: '3', watched_date: '2021-11-22' }),
      makeCsvOnlyEntry({ id: '4', watched_date: '2022-05-05' }),
    ];

    expect(resolveComparisonYears(historical, 'all')).toEqual([2020, 2021, 2022]);
    expect(resolveComparisonYears(historical, 2019)).toEqual([2019, 2021, 2022]);

    const monthly = computeMonthlyByYear(historical, [2020, 2021, 2022]);
    expect(monthly[2].month).toBe('Мар');
    expect(monthly[10].byYear[2021]).toBe(1);

    const cum = computeCumulativeComparison365(historical, [2020, 2021, 2022]);
    expect(cum[0].monthTick).toBe('Янв');
    expect(cum[364].byYear[2020]).toBe(1);
    expect(cum[364].byYear[2022]).toBe(1);
  });

  it('computes all-time Viewing Index trajectory from earliest year through reference date', () => {
    const trajectoryAll = computeViewingIndexTrajectory(DEMO_ENTRIES, 'all', DEFAULT_REFERENCE_DATE);
    const lastPt = trajectoryAll[trajectoryAll.length - 1];
    // 2024 (365) + 2025 (365) + 2026 day 324 = 1054 days, 314 total demo entries
    expect(lastPt.doy).toBe(1054);
    expect(lastPt.films).toBe(314);
    expect(lastPt.index).toBe(+(314 / 1054).toFixed(2));
  });
});
