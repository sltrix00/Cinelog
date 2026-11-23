export type WatchSource =
  | 'manual'
  | 'csv_letterboxd'
  | 'csv_imdb'
  | 'extension'
  | 'txt_diary';

export type TimeOfDayBucket = 0 | 1 | 2 | 3 | null;

export type YearFilter = number | 'all';

export type TasteCategory = 'directors' | 'countries' | 'genres';

export interface MovieRecord {
  id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  release_year: number | null;
  runtime_minutes: number | null;
  genres: string[];
  directors: string[];
  countries: string[];
  poster_url: string | null;
}

export interface WatchEntry {
  id: string;
  movie_id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  release_year: number | null;
  watched_date: string; // YYYY-MM-DD
  watched_time: string | null; // HH:MM:SS or null (for CSV imports)
  rating: number | null; // 0.5 - 5.0 scale
  is_rewatch: boolean;
  source: WatchSource;
  runtime_minutes: number | null;
  runtime_override_minutes: number | null;
  genres: string[];
  directors: string[];
  countries: string[];
  poster_url: string | null;
  import_key: string | null;
  created_at: string;
  /** Optional explicit unique key used by the deterministic demo generator */
  unique_key?: string;
}

export interface ProfileRecord {
  id: string;
  username: string | null;
  timezone: string;
  preferences: Record<string, unknown>;
}

export interface TmdbSearchResult {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
  overview: string;
}

export interface RewatchSummaryItem {
  id: string;
  title: string;
  watchedDate: string;
  dateLabel: string;
}

export interface Tier1KPIResult {
  allTimeTotal: number;
  allTimeUnique: number;
  allTimeRewatches: number;
  allTimeNewCount: number;
  yearTotal: number;
  yearNewCount: number;
  yearRewatches: number;
  yearRewatchPct: string;
  recentRewatches: RewatchSummaryItem[];
  activeMonthLabel: string;
  activeMonthSubtitle: string;
  monthTotal: number;
  monthRewatches: number;
  weekTotal: number;
  weekRewatches: number;
  yearIndex: number;
  daysElapsedYear: number;
  yearProjection: number | null;
  monthIndex: number;
  monthDaysElapsed: number;
  isMonthAboveYearPace: boolean;
}

export interface CumulativePoint365 {
  doy: number;
  dateLabel: string;
  monthTick: string;
  y2024: number;
  y2025: number;
  y2026: number;
  yoyDelta26vs25: number;
  byYear: Record<number, number>;
  yoyDelta: number | null;
  latestYear: number | null;
  prevYear: number | null;
}

export interface IndexTrajectoryPoint {
  doy: number;
  label: string;
  tooltipTitle: string;
  index: number;
  films: number;
}

export interface MonthlyYearPoint {
  month: string;
  monthIndex: number;
  y2024: number;
  y2025: number;
  y2026: number;
  byYear: Record<number, number>;
}

export interface DayOfWeekPoint {
  dowIndex: number;
  label: string;
  count: number;
  isPeak: boolean;
}

export interface DayOfWeekSummary {
  points: DayOfWeekPoint[];
  peakLabel: string;
  peakCount: number;
}

export interface TimeOfDayPoint {
  bucket: 0 | 1 | 2 | 3;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TimeOfDaySummary {
  hasTimeData: boolean;
  totalWithTime: number;
  points: TimeOfDayPoint[];
}

export interface HeatmapCell {
  doy: number;
  dateStr: string;
  dateLabel: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
  titles: string[];
}

export interface HeatmapSummary {
  year: number | 'all';
  cells: HeatmapCell[];
  activeDays: number;
  maxStreak: number;
  maxCount: number;
  foldedActiveDays?: number;
}

export interface RatingDistPoint {
  bucket: string;
  ratingValue: number;
  count: number;
}

export interface RatingTrendPoint {
  month: string;
  avgRating: number | null;
  count: number;
}

export interface RatingsSummary {
  averageRating: number;
  ratedCount: number;
  distribution: RatingDistPoint[];
  monthlyTrend: RatingTrendPoint[];
}

export interface ReleaseEraPoint {
  label: string;
  count: number;
  color: string;
}

export interface ReleaseErasSummary {
  points: ReleaseEraPoint[];
  classicCount: number;
  classicSharePct: number;
}

export interface RuntimeMonthPoint {
  month: string;
  hours: number;
  minutes: number;
}

export interface RuntimeSummary {
  points: RuntimeMonthPoint[];
  totalMinutes: number;
  totalHours: number;
  totalDays: string;
}

export interface TasteAccentItem {
  rank: number;
  name: string;
  count: number;
  pct: number;
  barPct: number;
  shareOfTotalPct: number;
  avgRating: string;
}

export interface ParsedImportRow {
  tempId: string;
  title: string;
  releaseYear: number | null;
  watchedDate: string; // YYYY-MM-DD
  watchedTime: string | null;
  rating: number | null;
  isRewatch: boolean;
  source: WatchSource;
  imdbId: string | null;
  tmdbId: number | null;
  runtimeMinutes: number | null;
  genres: string[];
  directors: string[];
  countries: string[];
  importKey: string;
  isDuplicate: boolean;
  autoRewatchDetected: boolean;
}

export interface ReferenceDateContext {
  year: number;
  monthIndex: number; // 0-11
  day: number;
  dayOfYear: number;
}

export interface TmdbBatchStats {
  total: number;
  matched: number;
  unmatched: number;
  tmdbConfigured: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  unmatchedTitles: string[];
}

export interface ReenrichSummary {
  totalProcessed: number;
  matchedCount: number;
  mergedCount: number;
  refreshedCount: number;
  unmatchedCount: number;
  tmdbConfigured: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  unmatchedTitles: string[];
}
