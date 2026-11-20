import type { ParsedImportRow, WatchEntry, WatchSource } from '../types/cinelog';

const MONTHS_RU_GEN: Record<string, number> = {
  'января': 0,
  'февраля': 1,
  'марта': 2,
  'апреля': 3,
  'мая': 4,
  'июня': 5,
  'июля': 6,
  'августа': 7,
  'сентября': 8,
  'октября': 9,
  'ноября': 10,
  'декабря': 11,
};

function makeTempId(): string {
  return `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function normalizeDateString(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    const y = Number.parseInt(iso[1], 10);
    const m = Number.parseInt(iso[2], 10);
    const d = Number.parseInt(iso[3], 10);
    if (y >= 1888 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD.MM.YYYY
  const dmy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) {
    const d = Number.parseInt(dmy[1], 10);
    const m = Number.parseInt(dmy[2], 10);
    const y = Number.parseInt(dmy[3], 10);
    if (y >= 1888 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

export function normalizeFiveStarRating(raw: string | number | null | undefined, scaleHint: '5' | '10' | 'auto' = 'auto'): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).replace(',', '.').trim());
  if (Number.isNaN(num) || num <= 0) return null;

  let fiveStar = num;
  if (scaleHint === '10' || (scaleHint === 'auto' && num > 5)) {
    fiveStar = num / 2;
  }
  const clamped = Math.min(5, Math.max(0.5, fiveStar));
  return Math.round(clamped * 2) / 2;
}

/**
 * RFC 4180 CSV parser supporting quoted commas, escaped quotes (""), and multi-line cells.
 */
export function parseCSVRecords(content: string): string[][] {
  const clean = content.replace(/^\uFEFF/, ''); // Strip UTF-8 BOM if present
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== '')) {
    rows.push(row);
  }

  return rows;
}

function splitMultiValue(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function detectCsvSource(headers: string[]): 'csv_letterboxd' | 'csv_imdb' {
  const set = new Set(headers.map((h) => h.toLowerCase()));
  if (set.has('const') || set.has('your rating') || set.has('date rated') || set.has('title type')) {
    return 'csv_imdb';
  }
  return 'csv_letterboxd';
}

export function parseCsvContent(content: string): ParsedImportRow[] {
  const matrix = parseCSVRecords(content);
  if (matrix.length < 2) return [];

  const rawHeaders = matrix[0];
  const headers = rawHeaders.map((h) => h.toLowerCase().trim());
  const detectedSource = detectCsvSource(headers);
  const parsed: ParsedImportRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const cols = matrix[r];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? '';
    });

    if (detectedSource === 'csv_imdb') {
      const title = row['title'] || row['original title'] || '';
      if (!title) continue;
      const imdbId = /^tt\d{5,10}$/.test(row['const'] ?? '') ? row['const'] : null;
      const releaseYear = Number.parseInt(row['year'] ?? '', 10) || null;
      const watchedDate =
        normalizeDateString(row['date rated']) ||
        normalizeDateString(row['created']) ||
        normalizeDateString(row['modified']) ||
        new Date().toISOString().slice(0, 10);
      const rating = normalizeFiveStarRating(row['your rating'], '10');
      const runtimeMinutes = Number.parseInt(row['runtime (mins)'] ?? '', 10) || null;

      parsed.push({
        tempId: makeTempId(),
        title,
        releaseYear,
        watchedDate,
        watchedTime: null, // CSV imports intentionally preserve null time
        rating,
        isRewatch: false,
        source: 'csv_imdb',
        imdbId,
        tmdbId: null,
        runtimeMinutes,
        genres: splitMultiValue(row['genres']),
        directors: splitMultiValue(row['directors']),
        countries: [],
        importKey: '',
        isDuplicate: false,
        autoRewatchDetected: false,
      });
      continue;
    }

    // Letterboxd / generic CSV
    const title = row['name'] || row['title'] || row['movie'] || '';
    if (!title) continue;

    const releaseYear = Number.parseInt(row['year'] || row['movieyear'] || row['release_year'] || '', 10) || null;
    const watchedDate =
      normalizeDateString(row['watched date']) ||
      normalizeDateString(row['date']) ||
      normalizeDateString(row['watched']) ||
      normalizeDateString(row['watchedat']) ||
      new Date().toISOString().slice(0, 10);
    const rating = normalizeFiveStarRating(row['rating'], 'auto');
    const rwRaw = (row['rewatch'] || row['rewatched'] || '').toLowerCase();
    const isRewatch = rwRaw === 'yes' || rwRaw === 'true' || rwRaw === '1';
    const rawTime = row['watched_time'] || row['time'] || '';
    const timeMatch = rawTime.match(/^(\d{1,2}:\d{2})(?::(\d{2}))?$/);
    const watchedTime = timeMatch
      ? `${timeMatch[1].padStart(5, '0')}:${timeMatch[2] ?? '00'}`
      : null;

    parsed.push({
      tempId: makeTempId(),
      title,
      releaseYear,
      watchedDate,
      watchedTime,
      rating,
      isRewatch,
      source: 'csv_letterboxd',
      imdbId: null,
      tmdbId: null,
      runtimeMinutes: Number.parseInt(row['runtime'] || row['runtime_minutes'] || '', 10) || null,
      genres: splitMultiValue(row['genres']),
      directors: splitMultiValue(row['directors']),
      countries: splitMultiValue(row['countries']),
      importKey: '',
      isDuplicate: false,
      autoRewatchDetected: false,
    });
  }

  return parsed;
}

function findTxtSeparator(text: string): number {
  const pattern = /\(\d{4}\)\s*[-–]/g;
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;
  while ((match = pattern.exec(text)) !== null) {
    lastMatch = match;
  }
  if (lastMatch) return lastMatch.index + lastMatch[0].indexOf(')') + 1;
  return text.indexOf(' - ');
}

function parseTxtDate(text: string, year: number): string | null {
  for (const [monthName, monthIndex] of Object.entries(MONTHS_RU_GEN)) {
    const match = text.match(new RegExp(`(\\d{1,2})(?:[-–]\\d{1,2})?\\s+${monthName}`, 'i'));
    if (match) {
      const day = Number.parseInt(match[1], 10);
      if (day >= 1 && day <= 31) {
        return toIsoDate(year, monthIndex, day);
      }
    }
  }
  return null;
}

function parseTxtTime(text: string): string | null {
  const match = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  const h = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function parseTxtRating(text: string): number | null {
  const match = text.match(/\(([~\d.]+(?:[-–][\d.]+)?)\s*\/\s*10\)/);
  if (!match) return null;
  const raw = match[1].replace('~', '');
  if (!raw || raw === '-') return null;
  let score10: number;
  if (raw.search(/[-–]/) > 0) {
    const parts = raw.split(/[-–]/).map((p) => Number.parseFloat(p));
    score10 = (parts[0] + parts[1]) / 2;
  } else {
    score10 = Number.parseFloat(raw);
  }
  return normalizeFiveStarRating(score10, '10');
}

export function parseRussianTxtDiary(content: string): ParsedImportRow[] {
  const lines = content.split(/\r?\n/);
  let currentYear = new Date().getFullYear();
  const rows: ParsedImportRow[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const yearHeader = line.match(/просмотренные фильмы\s+(\d{4})/i);
    if (yearHeader) {
      currentYear = Number.parseInt(yearHeader[1], 10);
      continue;
    }

    if (!/^\d/.test(line)) continue;
    const stripped = line.replace(/^\d+[.\s\t]+/, '').trim();
    if (!stripped) continue;

    const sepIdx = findTxtSeparator(stripped);
    if (sepIdx < 0) continue;

    const titlePart = stripped.substring(0, sepIdx).trim();
    const infoPart = stripped.substring(sepIdx).replace(/^\s*[-–]\s*/, '').trim();
    const titleMatch = titlePart.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const releaseYear = Number.parseInt(titleMatch[2], 10);
    const watchedDate = parseTxtDate(infoPart, currentYear) ?? `${currentYear}-01-01`;
    const watchedTime = parseTxtTime(infoPart);
    const rating = parseTxtRating(infoPart);
    const isRewatch = /🔁|Пересмотрел/i.test(rawLine);

    rows.push({
      tempId: makeTempId(),
      title,
      releaseYear,
      watchedDate,
      watchedTime,
      rating,
      isRewatch,
      source: 'txt_diary',
      imdbId: null,
      tmdbId: null,
      runtimeMinutes: null,
      genres: [],
      directors: [],
      countries: [],
      importKey: '',
      isDuplicate: false,
      autoRewatchDetected: false,
    });
  }

  return rows;
}

export function parseJsonImport(content: string): ParsedImportRow[] {
  const data = JSON.parse(content) as unknown;
  const items: Array<Record<string, unknown>> = Array.isArray(data)
    ? data
    : Array.isArray((data as { movies?: unknown[] })?.movies)
      ? ((data as { movies: Array<Record<string, unknown>> }).movies)
      : [];

  return items
    .map((item): ParsedImportRow | null => {
      const title = String(item.title ?? item.name ?? '').trim();
      if (!title) return null;

      const releaseYear = Number.parseInt(String(item.release_year ?? item.movieYear ?? item.year ?? ''), 10) || null;
      let watchedDate: string | null = null;
      if (typeof item.watched_date === 'string') {
        watchedDate = normalizeDateString(item.watched_date);
      } else if (typeof item.watchedAt === 'number') {
        const d = new Date(item.watchedAt);
        watchedDate = toIsoDate(d.getFullYear(), d.getMonth(), d.getDate());
      } else if (typeof item.watchedAt === 'string') {
        watchedDate = normalizeDateString(item.watchedAt);
      }

      const rawRating = item.rating as string | number | null | undefined;
      const rating = normalizeFiveStarRating(rawRating, 'auto');
      const isRewatch = Boolean(item.is_rewatch ?? item.rewatched);
      const watchedTime = typeof item.watched_time === 'string' ? item.watched_time : null;

      return {
        tempId: makeTempId(),
        title,
        releaseYear,
        watchedDate: watchedDate ?? new Date().toISOString().slice(0, 10),
        watchedTime,
        rating,
        isRewatch,
        source: (item.source as WatchSource) || 'csv_letterboxd',
        imdbId: typeof item.imdb_id === 'string' ? item.imdb_id : null,
        tmdbId: typeof item.tmdb_id === 'number' ? item.tmdb_id : null,
        runtimeMinutes: typeof item.runtime_minutes === 'number' ? item.runtime_minutes : null,
        genres: Array.isArray(item.genres) ? item.genres.map(String) : [],
        directors: Array.isArray(item.directors) ? item.directors.map(String) : [],
        countries: Array.isArray(item.countries) ? item.countries.map(String) : [],
        importKey: '',
        isDuplicate: false,
        autoRewatchDetected: false,
      };
    })
    .filter((x): x is ParsedImportRow => x !== null);
}

export async function parseImportFile(file: File): Promise<ParsedImportRow[]> {
  const content = await file.text();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'csv') return parseCsvContent(content);
  if (ext === 'txt') return parseRussianTxtDiary(content);
  if (ext === 'json') return parseJsonImport(content);
  throw new Error(`Неподдерживаемый формат файла: .${ext}`);
}

function filmIdentityKey(title: string, releaseYear: number | null): string {
  return `${title.trim().toLowerCase()}::${releaseYear ?? ''}`;
}

function exactWatchKey(title: string, releaseYear: number | null, watchedDate: string): string {
  return `${filmIdentityKey(title, releaseYear)}::${watchedDate}`;
}

/**
 * Annotates parsed import rows with duplicate flags, automatic rewatch detection,
 * and deterministic idempotent import_key values for Supabase batch upsert.
 */
export function annotateImportBatch(
  rows: ParsedImportRow[],
  existingEntries: WatchEntry[]
): ParsedImportRow[] {
  const seenExact = new Set<string>();
  const earliestSeenDate = new Map<string, string>();

  for (const existing of existingEntries) {
    seenExact.add(exactWatchKey(existing.title, existing.release_year, existing.watched_date));
    const filmKey = filmIdentityKey(existing.title, existing.release_year);
    const prev = earliestSeenDate.get(filmKey);
    if (!prev || existing.watched_date < prev) {
      earliestSeenDate.set(filmKey, existing.watched_date);
    }

    if (existing.original_title && existing.original_title.trim()) {
      seenExact.add(
        exactWatchKey(existing.original_title, existing.release_year, existing.watched_date)
      );
      const origFilmKey = filmIdentityKey(existing.original_title, existing.release_year);
      const prevOrig = earliestSeenDate.get(origFilmKey);
      if (!prevOrig || existing.watched_date < prevOrig) {
        earliestSeenDate.set(origFilmKey, existing.watched_date);
      }
    }
  }

  // Sort a copy chronologically so earlier watches in the same CSV establish first-watch dates
  const chronological = [...rows].sort((a, b) => a.watchedDate.localeCompare(b.watchedDate));
  const rowResults = new Map<string, ParsedImportRow>();
  const occurrenceCounts = new Map<string, number>();

  for (const row of chronological) {
    const exactKey = exactWatchKey(row.title, row.releaseYear, row.watchedDate);
    const filmKey = filmIdentityKey(row.title, row.releaseYear);
    const isDuplicate = seenExact.has(exactKey);

    let isRewatch = row.isRewatch;
    let autoRewatchDetected = false;

    if (!isDuplicate) {
      seenExact.add(exactKey);
      const firstDate = earliestSeenDate.get(filmKey);
      if (firstDate && firstDate < row.watchedDate) {
        if (!isRewatch) {
          autoRewatchDetected = true;
        }
        isRewatch = true;
      } else if (!firstDate) {
        earliestSeenDate.set(filmKey, row.watchedDate);
      }
    }

    const baseKey = `${row.source}:${row.title.trim().toLowerCase().slice(0, 120)}:${row.releaseYear ?? 0}:${row.watchedDate}`;
    const occ = (occurrenceCounts.get(baseKey) ?? 0) + 1;
    occurrenceCounts.set(baseKey, occ);

    rowResults.set(row.tempId, {
      ...row,
      isRewatch,
      isDuplicate,
      autoRewatchDetected,
      importKey: `${baseKey}:${occ}`.slice(0, 300),
    });
  }

  return rows.map((r) => rowResults.get(r.tempId)!);
}

export function parsedRowsToLocalWatchEntries(rows: ParsedImportRow[]): WatchEntry[] {
  return rows
    .filter((r) => !r.isDuplicate)
    .map((r, idx) => ({
      id: `local-${Date.now()}-${idx}`,
      movie_id: `local-movie-${r.title.toLowerCase().replace(/\s+/g, '-')}-${r.releaseYear ?? 0}`,
      tmdb_id: r.tmdbId,
      imdb_id: r.imdbId,
      title: r.title,
      original_title: null,
      release_year: r.releaseYear,
      watched_date: r.watchedDate,
      watched_time: r.watchedTime,
      rating: r.rating,
      is_rewatch: r.isRewatch,
      source: r.source,
      runtime_minutes: r.runtimeMinutes ?? 120,
      runtime_override_minutes: null,
      genres: r.genres,
      directors: r.directors,
      countries: r.countries,
      poster_url: null,
      import_key: r.importKey,
      created_at: `${r.watchedDate}T${r.watchedTime ?? '00:00:00'}Z`,
    }));
}
