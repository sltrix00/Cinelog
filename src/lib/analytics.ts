import type {
  CumulativePoint365,
  DayOfWeekPoint,
  DayOfWeekSummary,
  HeatmapCell,
  HeatmapSummary,
  IndexTrajectoryPoint,
  MonthlyYearPoint,
  RatingsSummary,
  ReferenceDateContext,
  ReleaseErasSummary,
  RewatchSummaryItem,
  RuntimeSummary,
  TasteAccentItem,
  TasteCategory,
  Tier1KPIResult,
  TimeOfDayBucket,
  TimeOfDaySummary,
  WatchEntry,
  YearFilter,
} from '../types/cinelog';
import { SIM_DAY, SIM_DAY_OF_YEAR, SIM_MONTH_IDX, SIM_YEAR } from './demoData';

export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'] as const;
export const MONTHS_RU_NOM = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const;
export const MONTHS_RU_PREP = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
] as const;
export const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

export const MONTH_STARTS_NONLEAP = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335] as const;
export const DOW_LABELS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export const DEFAULT_REFERENCE_DATE: ReferenceDateContext = {
  year: SIM_YEAR,
  monthIndex: SIM_MONTH_IDX,
  day: SIM_DAY,
  dayOfYear: SIM_DAY_OF_YEAR,
};

export function filmWord(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const m10 = abs % 10;
  const m100 = abs % 100;
  if (m10 === 1 && m100 !== 11) return 'фильм';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'фильма';
  return 'фильмов';
}

export function rewatchWord(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const m10 = abs % 10;
  const m100 = abs % 100;
  if (m10 === 1 && m100 !== 11) return 'пересмотр';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'пересмотра';
  return 'пересмотров';
}

export function parseIsoDateParts(dateStr: string): { year: number; monthIndex: number; day: number } {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return { year: SIM_YEAR, monthIndex: 0, day: 1 };
  }
  return {
    year: Number.parseInt(m[1], 10),
    monthIndex: Math.max(0, Math.min(11, Number.parseInt(m[2], 10) - 1)),
    day: Math.max(1, Math.min(31, Number.parseInt(m[3], 10))),
  };
}

export function getDayOfYear(dateStr: string): number {
  const { year, monthIndex, day } = parseIsoDateParts(dateStr);
  const startUtc = Date.UTC(year, 0, 1);
  const targetUtc = Date.UTC(year, monthIndex, day);
  return Math.round((targetUtc - startUtc) / 86_400_000) + 1;
}

export function getDayOfWeekMonSun(dateStr: string): number {
  const { year, monthIndex, day } = parseIsoDateParts(dateStr);
  const jsDow = new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
  return (jsDow + 6) % 7; // 0 = Mon ... 6 = Sun
}

export function dayOfYearToParts(year: number, doy: number): { monthIndex: number; day: number; dateStr: string } {
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(doy);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { monthIndex: m, day, dateStr };
}

export function formatDayOfYearRu(doy: number, year = SIM_YEAR): string {
  const { monthIndex, day } = dayOfYearToParts(year, doy);
  return `${day} ${MONTHS_RU_GEN[monthIndex]}`;
}

export function formatShortDateRu(dateStr: string): string {
  const { monthIndex, day } = parseIsoDateParts(dateStr);
  return `${day} ${MONTHS_RU[monthIndex].toLowerCase()}`;
}

export function timeStringToBucket(watchedTime: string | null | undefined): TimeOfDayBucket {
  if (!watchedTime) return null;
  const match = watchedTime.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  if (hour >= 5 && hour < 12) return 0; // Утро
  if (hour >= 12 && hour < 17) return 1; // День
  if (hour >= 17 && hour < 23) return 2; // Вечер
  return 3; // Ночь (23:00 - 04:59)
}

export function getUniqueFilmKey(entry: WatchEntry): string {
  if (entry.unique_key) return entry.unique_key;
  if (entry.tmdb_id) return `tmdb:${entry.tmdb_id}`;
  if (entry.movie_id) return `movie:${entry.movie_id}`;
  return `${entry.title.trim().toLowerCase()}__${entry.release_year ?? ''}`;
}

export function extractAvailableYears(
  entries: WatchEntry[],
  baseYears: number[] = [2024, 2025, 2026]
): number[] {
  const yearSet = new Set<number>(
    baseYears.filter((y) => Number.isInteger(y) && y >= 1888 && y <= 2100)
  );
  for (const entry of entries) {
    const { year } = parseIsoDateParts(entry.watched_date);
    if (Number.isInteger(year) && year >= 1888 && year <= 2100) {
      yearSet.add(year);
    }
  }
  return Array.from(yearSet).sort((a, b) => a - b);
}

export function filterEntriesByYear(entries: WatchEntry[], selectedYear: YearFilter): WatchEntry[] {
  if (selectedYear === 'all') return entries;
  return entries.filter((e) => parseIsoDateParts(e.watched_date).year === selectedYear);
}

export function getEffectiveRuntime(entry: WatchEntry): number {
  return entry.runtime_override_minutes ?? entry.runtime_minutes ?? 0;
}

export function getReferenceDateForToday(): ReferenceDateContext {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const day = now.getDate();
  const startUtc = Date.UTC(year, 0, 1);
  const targetUtc = Date.UTC(year, monthIndex, day);
  const dayOfYear = Math.round((targetUtc - startUtc) / 86_400_000) + 1;
  return { year, monthIndex, day, dayOfYear };
}

export function computeTier1KPIs(
  entries: WatchEntry[],
  selectedYear: YearFilter,
  refDate: ReferenceDateContext = DEFAULT_REFERENCE_DATE
): Tier1KPIResult {
  const allTimeTotal = entries.length;
  const allTimeUnique = new Set(entries.map(getUniqueFilmKey)).size;
  const allTimeRewatches = entries.filter((e) => e.is_rewatch).length;
  const allTimeNewCount = allTimeTotal - allTimeRewatches;

  const scoped = filterEntriesByYear(entries, selectedYear);
  const yearTotal = scoped.length;
  const rewatchLogs = scoped.filter((e) => e.is_rewatch);
  const yearRewatches = rewatchLogs.length;
  const yearNewCount = yearTotal - yearRewatches;
  const yearRewatchPct = yearTotal > 0 ? ((yearRewatches / yearTotal) * 100).toFixed(1) : '0.0';

  const recentRewatches: RewatchSummaryItem[] = [...rewatchLogs]
    .sort((a, b) => b.watched_date.localeCompare(a.watched_date))
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      title: r.title,
      watchedDate: r.watched_date,
      dateLabel: formatShortDateRu(r.watched_date),
    }));

  const activeYearForPeriod = selectedYear === 'all' ? refDate.year : selectedYear;
  const isCurrentRefYear = activeYearForPeriod === refDate.year;
  const activeMonthIdx = isCurrentRefYear ? refDate.monthIndex : 11;
  const monthDaysElapsed = isCurrentRefYear ? refDate.day : 31;

  const periodYearLogs = filterEntriesByYear(entries, activeYearForPeriod);
  const monthLogs = periodYearLogs.filter((e) => parseIsoDateParts(e.watched_date).monthIndex === activeMonthIdx);
  const monthTotal = monthLogs.length;
  const monthRewatches = monthLogs.filter((e) => e.is_rewatch).length;

  const refDoy = isCurrentRefYear ? refDate.dayOfYear : 365;
  const weekLogs = periodYearLogs.filter((e) => {
    const doy = getDayOfYear(e.watched_date);
    return doy > refDoy - 7 && doy <= refDoy;
  });
  const weekTotal = weekLogs.length;
  const weekRewatches = weekLogs.filter((e) => e.is_rewatch).length;

  let daysElapsedYear: number;
  if (selectedYear === 'all') {
    const distinctPastYears = new Set(
      entries
        .map((e) => parseIsoDateParts(e.watched_date).year)
        .filter((y) => y < refDate.year)
    );
    daysElapsedYear = Math.max(1, distinctPastYears.size * 365 + refDate.dayOfYear);
  } else {
    daysElapsedYear = selectedYear === refDate.year ? Math.max(1, refDate.dayOfYear) : 365;
  }

  const yearIndex = yearTotal / daysElapsedYear;
  const monthIndex = monthTotal / Math.max(1, monthDaysElapsed);
  const yearProjection = selectedYear === refDate.year ? Math.round(yearIndex * 365) : null;

  return {
    allTimeTotal,
    allTimeUnique,
    allTimeRewatches,
    allTimeNewCount,
    yearTotal,
    yearNewCount,
    yearRewatches,
    yearRewatchPct,
    recentRewatches,
    activeMonthLabel: `За ${MONTHS_RU_NOM[activeMonthIdx]}`,
    activeMonthSubtitle: isCurrentRefYear
      ? `1–${refDate.day} ${MONTHS_RU_GEN[activeMonthIdx]} ${activeYearForPeriod}`
      : `Полный ${MONTHS_RU_NOM[activeMonthIdx]} ${activeYearForPeriod}`,
    monthTotal,
    monthRewatches,
    weekTotal,
    weekRewatches,
    yearIndex,
    daysElapsedYear,
    yearProjection,
    monthIndex,
    monthDaysElapsed,
    isMonthAboveYearPace: monthIndex >= yearIndex,
  };
}

export function getCumulativeArray365(entries: WatchEntry[], year: number): number[] {
  const countsPerDay = new Array<number>(366).fill(0);
  for (const entry of entries) {
    const { year: entryYear } = parseIsoDateParts(entry.watched_date);
    if (entryYear !== year) continue;
    const doy = Math.min(365, Math.max(1, getDayOfYear(entry.watched_date)));
    countsPerDay[doy] += 1;
  }

  const cum: number[] = [];
  let sum = 0;
  for (let d = 1; d <= 365; d++) {
    sum += countsPerDay[d];
    cum.push(sum);
  }
  return cum;
}

export function resolveComparisonYears(
  entries: WatchEntry[],
  selectedYear: YearFilter,
  availableYears?: number[]
): number[] {
  const yearsWithData = new Set<number>();
  for (const e of entries) {
    const { year } = parseIsoDateParts(e.watched_date);
    if (Number.isInteger(year) && year >= 1888 && year <= 2100) {
      yearsWithData.add(year);
    }
  }

  const pool =
    yearsWithData.size > 0
      ? Array.from(yearsWithData).sort((a, b) => a - b)
      : (availableYears && availableYears.length > 0 ? [...availableYears] : [2024, 2025, 2026]).sort(
          (a, b) => a - b
        );

  if (selectedYear !== 'all' && !pool.includes(selectedYear)) {
    pool.push(selectedYear);
    pool.sort((a, b) => a - b);
  }

  if (pool.length <= 3) return pool;

  if (selectedYear !== 'all') {
    const idx = pool.indexOf(selectedYear);
    if (idx !== -1 && idx < pool.length - 3) {
      return [selectedYear, pool[pool.length - 2], pool[pool.length - 1]];
    }
  }

  return pool.slice(-3);
}

export function computeCumulativeComparison365(
  entries: WatchEntry[],
  comparisonYears: number[] = [2024, 2025, 2026]
): CumulativePoint365[] {
  const sortedYears = [...comparisonYears].sort((a, b) => a - b);
  const cumByYear = new Map<number, number[]>();
  for (const yr of sortedYears) {
    cumByYear.set(yr, getCumulativeArray365(entries, yr));
  }

  const c2024 = cumByYear.get(2024) ?? getCumulativeArray365(entries, 2024);
  const c2025 = cumByYear.get(2025) ?? getCumulativeArray365(entries, 2025);
  const c2026 = cumByYear.get(2026) ?? getCumulativeArray365(entries, 2026);

  const latestYear = sortedYears.length > 0 ? sortedYears[sortedYears.length - 1] : null;
  const prevYear = sortedYears.length > 1 ? sortedYears[sortedYears.length - 2] : null;

  const points: CumulativePoint365[] = [];
  for (let d = 1; d <= 365; d++) {
    const idx = d - 1;
    const monthStartIdx = (MONTH_STARTS_NONLEAP as readonly number[]).indexOf(d);
    const byYear: Record<number, number> = {};
    for (const yr of sortedYears) {
      byYear[yr] = cumByYear.get(yr)?.[idx] ?? 0;
    }

    const yoyDelta =
      latestYear !== null && prevYear !== null ? byYear[latestYear] - byYear[prevYear] : null;

    points.push({
      doy: d,
      dateLabel: `${formatDayOfYearRu(d)} · День ${d}`,
      monthTick: monthStartIdx !== -1 ? MONTHS_RU[monthStartIdx] : '',
      y2024: c2024[idx],
      y2025: c2025[idx],
      y2026: c2026[idx],
      yoyDelta26vs25: c2026[idx] - c2025[idx],
      byYear,
      yoyDelta,
      latestYear,
      prevYear,
    });
  }
  return points;
}

export function computeViewingIndexTrajectory(
  entries: WatchEntry[],
  selectedYear: YearFilter,
  refDate: ReferenceDateContext = DEFAULT_REFERENCE_DATE
): IndexTrajectoryPoint[] {
  if (selectedYear === 'all') {
    const entryYears = entries
      .map((e) => parseIsoDateParts(e.watched_date).year)
      .filter((y) => Number.isInteger(y) && y >= 1888 && y <= refDate.year);

    const minYear = entryYears.length > 0 ? Math.min(...entryYears) : refDate.year;
    if (minYear === refDate.year) {
      return computeViewingIndexTrajectory(entries, refDate.year, refDate);
    }

    // Build continuous daily cumulative counts across [minYear .. refDate.year]
    const dailyFilmCounts: Array<{ year: number; doy: number; count: number }> = [];
    const countsByYear = new Map<number, number[]>();
    for (let y = minYear; y <= refDate.year; y++) {
      countsByYear.set(y, new Array<number>(366).fill(0));
    }

    for (const entry of entries) {
      const { year } = parseIsoDateParts(entry.watched_date);
      const arr = countsByYear.get(year);
      if (!arr) continue;
      const doy = Math.min(365, Math.max(1, getDayOfYear(entry.watched_date)));
      if (year === refDate.year && doy > refDate.dayOfYear) continue;
      arr[doy] += 1;
    }

    for (let y = minYear; y <= refDate.year; y++) {
      const arr = countsByYear.get(y)!;
      const maxD = y === refDate.year ? refDate.dayOfYear : 365;
      for (let d = 1; d <= maxD; d++) {
        dailyFilmCounts.push({ year: y, doy: d, count: arr[d] });
      }
    }

    const totalDays = dailyFilmCounts.length;
    const cumFilms: number[] = [];
    let running = 0;
    for (const item of dailyFilmCounts) {
      running += item.count;
      cumFilms.push(running);
    }

    const step = totalDays > 400 ? 10 : 5;
    const points: IndexTrajectoryPoint[] = [];

    for (let globalDay = step; globalDay <= totalDays; globalDay += step) {
      const meta = dailyFilmCounts[globalDay - 1];
      const films = cumFilms[globalDay - 1];
      const { monthIndex } = dayOfYearToParts(meta.year, meta.doy);
      const dayRu = formatDayOfYearRu(meta.doy, meta.year);
      points.push({
        doy: globalDay,
        label: `${MONTHS_RU[monthIndex]} ${String(meta.year).slice(2)}`,
        tooltipTitle: `${dayRu} ${meta.year} · День ${globalDay}`,
        index: +(films / globalDay).toFixed(2),
        films,
      });
    }

    if (totalDays > 0 && points[points.length - 1]?.doy !== totalDays) {
      const meta = dailyFilmCounts[totalDays - 1];
      const films = cumFilms[totalDays - 1];
      const { monthIndex } = dayOfYearToParts(meta.year, meta.doy);
      const dayRu = formatDayOfYearRu(meta.doy, meta.year);
      points.push({
        doy: totalDays,
        label: `${MONTHS_RU[monthIndex]} ${String(meta.year).slice(2)}`,
        tooltipTitle: `${dayRu} ${meta.year} · День ${totalDays}`,
        index: +(films / totalDays).toFixed(2),
        films,
      });
    }

    return points;
  }

  const targetYear = selectedYear;
  const maxDoy = targetYear === refDate.year ? refDate.dayOfYear : 365;
  const cumArr = getCumulativeArray365(entries, targetYear);

  const points: IndexTrajectoryPoint[] = [];
  for (let d = 5; d <= maxDoy; d += 5) {
    const films = cumArr[d - 1];
    const label = formatDayOfYearRu(d, targetYear);
    points.push({
      doy: d,
      label,
      tooltipTitle: `${label} ${targetYear} · День ${d}`,
      index: +(films / d).toFixed(2),
      films,
    });
  }

  if (points[points.length - 1]?.doy !== maxDoy) {
    const films = cumArr[maxDoy - 1];
    const label = formatDayOfYearRu(maxDoy, targetYear);
    points.push({
      doy: maxDoy,
      label,
      tooltipTitle: `${label} ${targetYear} · День ${maxDoy}`,
      index: +(films / maxDoy).toFixed(2),
      films,
    });
  }

  return points;
}

export function computeMonthlyByYear(
  entries: WatchEntry[],
  comparisonYears: number[] = [2024, 2025, 2026]
): MonthlyYearPoint[] {
  const sortedYears = [...comparisonYears].sort((a, b) => a - b);
  const countsMap = new Map<number, number[]>();
  for (const yr of sortedYears) {
    countsMap.set(yr, new Array<number>(12).fill(0));
  }
  for (const fixedYr of [2024, 2025, 2026]) {
    if (!countsMap.has(fixedYr)) {
      countsMap.set(fixedYr, new Array<number>(12).fill(0));
    }
  }

  for (const entry of entries) {
    const { year, monthIndex } = parseIsoDateParts(entry.watched_date);
    const arr = countsMap.get(year);
    if (arr) {
      arr[monthIndex] += 1;
    }
  }

  return MONTHS_RU.map((month, idx) => {
    const byYear: Record<number, number> = {};
    for (const yr of sortedYears) {
      byYear[yr] = countsMap.get(yr)?.[idx] ?? 0;
    }
    return {
      month,
      monthIndex: idx,
      y2024: countsMap.get(2024)?.[idx] ?? 0,
      y2025: countsMap.get(2025)?.[idx] ?? 0,
      y2026: countsMap.get(2026)?.[idx] ?? 0,
      byYear,
    };
  });
}

export function computeDayOfWeekDistribution(
  entries: WatchEntry[],
  selectedYear: YearFilter
): DayOfWeekSummary {
  const scoped = filterEntriesByYear(entries, selectedYear);
  const dowCounts = new Array<number>(7).fill(0);

  for (const entry of scoped) {
    const dow = getDayOfWeekMonSun(entry.watched_date);
    dowCounts[dow] += 1;
  }

  const maxCount = Math.max(...dowCounts);
  const peakIdx = maxCount > 0 ? dowCounts.indexOf(maxCount) : 0;

  const points: DayOfWeekPoint[] = DOW_LABELS_RU.map((label, idx) => ({
    dowIndex: idx,
    label,
    count: dowCounts[idx],
    isPeak: maxCount > 0 && idx === peakIdx,
  }));

  return {
    points,
    peakLabel: DOW_LABELS_RU[peakIdx],
    peakCount: maxCount,
  };
}

const TOD_META: Array<{ bucket: 0 | 1 | 2 | 3; label: string; color: string }> = [
  { bucket: 0, label: '05:00–11:59', color: '#d6b85a' },
  { bucket: 1, label: '12:00–16:59', color: '#45d1c6' },
  { bucket: 2, label: '17:00–22:59', color: '#f06292' },
  { bucket: 3, label: '23:00–04:59', color: '#6366f1' },
];

export function computeTimeOfDayDistribution(
  entries: WatchEntry[],
  selectedYear: YearFilter
): TimeOfDaySummary {
  const scoped = filterEntriesByYear(entries, selectedYear);
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  let totalWithTime = 0;

  for (const entry of scoped) {
    const bucket = timeStringToBucket(entry.watched_time);
    if (bucket !== null) {
      counts[bucket] += 1;
      totalWithTime += 1;
    }
  }

  const hasTimeData = totalWithTime > 0;
  const denom = Math.max(1, totalWithTime);

  return {
    hasTimeData,
    totalWithTime,
    points: TOD_META.map((meta) => ({
      bucket: meta.bucket,
      label: meta.label,
      count: counts[meta.bucket],
      percentage: +((counts[meta.bucket] / denom) * 100).toFixed(1),
      color: meta.color,
    })),
  };
}

function computeTrueChronologicalStreak(entries: WatchEntry[]): {
  distinctDays: number;
  maxStreak: number;
} {
  const epochDays = new Set<number>();
  for (const entry of entries) {
    const m = entry.watched_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) continue;
    const y = Number.parseInt(m[1], 10);
    const mo = Number.parseInt(m[2], 10) - 1;
    const d = Number.parseInt(m[3], 10);
    const epochDay = Math.floor(Date.UTC(y, mo, d) / 86_400_000);
    epochDays.add(epochDay);
  }

  const sorted = Array.from(epochDays).sort((a, b) => a - b);
  let maxStreak = 0;
  let curr = 0;
  let prev: number | null = null;
  for (const day of sorted) {
    if (prev !== null && day === prev + 1) {
      curr += 1;
    } else {
      curr = 1;
    }
    if (curr > maxStreak) maxStreak = curr;
    prev = day;
  }

  return {
    distinctDays: sorted.length,
    maxStreak,
  };
}

export function computeActivityHeatmap(
  entries: WatchEntry[],
  selectedYear: YearFilter,
  refDate: ReferenceDateContext = DEFAULT_REFERENCE_DATE
): HeatmapSummary {
  const isAll = selectedYear === 'all';
  const scoped = isAll
    ? entries
    : entries.filter((e) => parseIsoDateParts(e.watched_date).year === selectedYear);

  const countsByDoy = new Array<number>(366).fill(0);
  const titlesByDoy = Array.from({ length: 366 }, () => [] as string[]);

  for (const entry of scoped) {
    const doy = Math.min(365, Math.max(1, getDayOfYear(entry.watched_date)));
    countsByDoy[doy] += 1;
    const labelTitle = isAll
      ? `${entry.title} (${entry.watched_date.slice(0, 4)})`
      : entry.title;
    titlesByDoy[doy].push(labelTitle);
  }

  const labelYear = isAll ? refDate.year : selectedYear;
  const maxDoy = !isAll && selectedYear === refDate.year ? refDate.dayOfYear : 365;
  const cells: HeatmapCell[] = [];
  let foldedActiveDays = 0;
  let maxStreak = 0;
  let currStreak = 0;

  for (let doy = 1; doy <= 365; doy++) {
    const isFuture = !isAll && selectedYear === refDate.year && doy > maxDoy;
    const count = isFuture ? 0 : countsByDoy[doy];

    if (!isFuture && count > 0) {
      foldedActiveDays += 1;
      currStreak += 1;
      if (currStreak > maxStreak) maxStreak = currStreak;
    } else {
      currStreak = 0;
    }

    const intensity: 0 | 1 | 2 | 3 =
      count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;

    const { dateStr } = dayOfYearToParts(labelYear, doy);
    cells.push({
      doy,
      dateStr,
      dateLabel: isAll ? formatDayOfYearRu(doy, labelYear) : `${formatDayOfYearRu(doy, labelYear)} ${labelYear}`,
      count,
      intensity,
      isFuture,
      titles: isFuture ? [] : titlesByDoy[doy],
    });
  }

  if (isAll) {
    const chrono = computeTrueChronologicalStreak(scoped);
    return {
      year: selectedYear,
      cells,
      activeDays: chrono.distinctDays,
      maxStreak: chrono.maxStreak,
      foldedActiveDays,
    };
  }

  return {
    year: selectedYear,
    cells,
    activeDays: foldedActiveDays,
    maxStreak,
    foldedActiveDays,
  };
}

export function computeRatingsAnalytics(
  entries: WatchEntry[],
  selectedYear: YearFilter
): RatingsSummary {
  const scoped = filterEntriesByYear(entries, selectedYear);
  const rated = scoped.filter((e): e is WatchEntry & { rating: number } => e.rating !== null);

  const averageRating =
    rated.length > 0 ? rated.reduce((sum, e) => sum + e.rating, 0) / rated.length : 0;

  const hasHalfStar = rated.some((e) => e.rating === 0.5);
  const buckets = hasHalfStar
    ? [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
    : [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  const distribution = buckets.map((b) => ({
    bucket: `${b.toFixed(1)}★`,
    ratingValue: b,
    count: rated.filter((e) => Math.abs(e.rating - b) < 0.01).length,
  }));

  const monthSums = new Array<number>(12).fill(0);
  const monthCnts = new Array<number>(12).fill(0);

  for (const entry of rated) {
    const { monthIndex } = parseIsoDateParts(entry.watched_date);
    monthSums[monthIndex] += entry.rating;
    monthCnts[monthIndex] += 1;
  }

  const monthlyTrend = MONTHS_RU.map((month, idx) => ({
    month,
    avgRating: monthCnts[idx] > 0 ? +(monthSums[idx] / monthCnts[idx]).toFixed(2) : null,
    count: monthCnts[idx],
  }));

  return {
    averageRating,
    ratedCount: rated.length,
    distribution,
    monthlyTrend,
  };
}

export function computeReleaseEras(
  entries: WatchEntry[],
  selectedYear: YearFilter
): ReleaseErasSummary {
  const scoped = filterEntriesByYear(entries, selectedYear);
  const labels = ['до 1980', '1980-е', '1990-е', '2000-е', '2010-е', '2020–2026'];
  const colors = ['#3b4566', '#4a557c', '#5c6996', '#45d1c6', '#818cf8', '#f06292'];
  const counts = [0, 0, 0, 0, 0, 0];
  let classicCount = 0;
  let withYearCount = 0;

  for (const entry of scoped) {
    const ry = entry.release_year;
    if (ry === null || ry === undefined) continue;
    withYearCount += 1;
    if (ry < 1980) {
      counts[0] += 1;
      classicCount += 1;
    } else if (ry < 1990) {
      counts[1] += 1;
      classicCount += 1;
    } else if (ry < 2000) {
      counts[2] += 1;
      classicCount += 1;
    } else if (ry < 2010) {
      counts[3] += 1;
    } else if (ry < 2020) {
      counts[4] += 1;
    } else {
      counts[5] += 1;
    }
  }

  const classicSharePct = withYearCount > 0 ? Math.round((classicCount / withYearCount) * 100) : 0;

  return {
    points: labels.map((label, idx) => ({
      label,
      count: counts[idx],
      color: colors[idx],
    })),
    classicCount,
    classicSharePct,
  };
}

export function computeRuntimeAnalytics(
  entries: WatchEntry[],
  selectedYear: YearFilter
): RuntimeSummary {
  const scoped = filterEntriesByYear(entries, selectedYear);
  const monthMins = new Array<number>(12).fill(0);
  let totalMinutes = 0;

  for (const entry of scoped) {
    const mins = getEffectiveRuntime(entry);
    if (mins <= 0) continue;
    const { monthIndex } = parseIsoDateParts(entry.watched_date);
    monthMins[monthIndex] += mins;
    totalMinutes += mins;
  }

  return {
    points: MONTHS_RU.map((month, idx) => ({
      month,
      hours: +(monthMins[idx] / 60).toFixed(1),
      minutes: monthMins[idx],
    })),
    totalMinutes,
    totalHours: Math.round(totalMinutes / 60),
    totalDays: (totalMinutes / 60 / 24).toFixed(1),
  };
}

export function computeTasteAccents(
  entries: WatchEntry[],
  selectedYear: YearFilter,
  category: TasteCategory
): TasteAccentItem[] {
  const scoped = filterEntriesByYear(entries, selectedYear);
  const totalFilmsInScope = Math.max(1, scoped.length);
  const agg = new Map<string, { name: string; count: number; ratingSum: number; ratedCount: number }>();

  for (const entry of scoped) {
    const values =
      category === 'directors'
        ? entry.directors
        : category === 'countries'
          ? entry.countries
          : entry.genres;

    for (const raw of values) {
      const name = raw.trim();
      if (!name) continue;
      const existing = agg.get(name) ?? { name, count: 0, ratingSum: 0, ratedCount: 0 };
      existing.count += 1;
      if (entry.rating !== null) {
        existing.ratingSum += entry.rating;
        existing.ratedCount += 1;
      }
      agg.set(name, existing);
    }
  }

  const top = Array.from(agg.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
    .slice(0, 6);

  const maxCount = Math.max(1, ...top.map((item) => item.count));

  return top.map((item, idx) => {
    const barPct = Math.round((item.count / maxCount) * 100);
    const shareOfTotalPct = Math.round((item.count / totalFilmsInScope) * 100);
    return {
      rank: idx + 1,
      name: item.name,
      count: item.count,
      pct: barPct,
      barPct,
      shareOfTotalPct,
      avgRating: item.ratedCount > 0 ? (item.ratingSum / item.ratedCount).toFixed(2) : '—',
    };
  });
}
