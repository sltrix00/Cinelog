import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import {
  buildSearchAttempts,
  localizeCountries,
  normalizeDirectors,
  normalizeGenres,
  parseReleaseYear,
  pickBestCandidate,
  type TmdbSearchCandidate,
} from './matching.ts';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BATCH_CONCURRENCY = 4;
const CACHE_LANGUAGE = 'ru-RU';
const PUBLIC_MOVIE_COLUMNS =
  'id, tmdb_id, imdb_id, title, original_title, release_year, runtime_minutes, genres, directors, countries, poster_url, created_at, updated_at';
const INTERNAL_MOVIE_COLUMNS = `${PUBLIC_MOVIE_COLUMNS}, created_by`;
const ALLOWED_SEARCH_LANGUAGES = new Set(['ru-RU', 'en-US']);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const HEAVY_RATE_LIMIT_MAX_REQUESTS = 35;
const MAX_REQUEST_BODY_BYTES = 262_144; // 256 KB
const MAX_PG_INT4 = 2_147_483_647;
const userRequestTimestamps = new Map<string, number[]>();
const heavyRequestTimestamps = new Map<string, number[]>();
let warnedLegacyApiKey = false;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://sltrix00.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function getAllowedOrigins(): Set<string> {
  const extra = (Deno.env.get('ALLOWED_CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
}

function getCorsContext(req: Request): { allowed: boolean; headers: Record<string, string> } {
  const origin = req.headers.get('Origin');
  if (!origin) {
    return {
      allowed: true,
      headers: {
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
  }

  if (getAllowedOrigins().has(origin)) {
    return {
      allowed: true,
      headers: {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
  }

  return {
    allowed: false,
    headers: { Vary: 'Origin' },
  };
}

function logSecurityEvent(event: string, meta: Record<string, unknown> = {}): void {
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: 'tmdb-proxy',
      event,
      ...meta,
    })
  );
}

type TmdbErrorCode =
  | 'TMDB_NOT_CONFIGURED'
  | 'TMDB_AUTH_ERROR'
  | 'TMDB_RATE_LIMITED'
  | 'TMDB_HTTP_ERROR'
  | 'TMDB_NETWORK_ERROR';

class TmdbApiError extends Error {
  code: TmdbErrorCode;
  status?: number;

  constructor(code: TmdbErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'TmdbApiError';
    this.code = code;
    this.status = status;
  }
}

class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

interface MovieRow {
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
  updated_at: string;
}

interface InternalMovieRow extends MovieRow {
  created_by: string | null;
}

interface SearchRequest {
  action: 'search';
  query: string;
  year?: number | null;
  language?: string;
}

interface EnrichRequest {
  action: 'enrich';
  tmdbId: number;
  language?: string;
}

interface BatchItem {
  title: string;
  year?: number | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  fallbackRuntimeMinutes?: number | null;
  fallbackGenres?: string[];
  fallbackDirectors?: string[];
  fallbackCountries?: string[];
}

interface ResolveBatchRequest {
  action: 'resolve_batch';
  items: BatchItem[];
  language?: string;
}

interface ReenrichUnmatchedRequest {
  action: 'reenrich_unmatched';
  movieIds?: string[];
  language?: string;
  limit?: number;
}

type ProxyRequest = SearchRequest | EnrichRequest | ResolveBatchRequest | ReenrichUnmatchedRequest;

function jsonResponse(
  payload: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function getEnv(name: string): string {
  return Deno.env.get(name) ?? '';
}

function resolveNamedApiKey(jsonEnvName: string, fallbackEnvNames: string[]): string {
  const rawJson = getEnv(jsonEnvName).trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.default === 'string' && parsed.default.trim()) {
          return parsed.default.trim();
        }
        for (const value of Object.values(parsed)) {
          if (typeof value === 'string' && value.trim()) {
            return value.trim();
          }
        }
      }
    } catch {
      // Fall back to single-key env vars if JSON env var is absent/malformed
    }
  }
  for (const name of fallbackEnvNames) {
    const val = getEnv(name).trim();
    if (val) return val;
  }
  return '';
}

function isTmdbConfigured(): boolean {
  return Boolean(getEnv('TMDB_READ_ACCESS_TOKEN').trim() || getEnv('TMDB_API_KEY').trim());
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function parsePositiveInt4(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_PG_INT4
    ? value
    : null;
}

function sanitizeStringList(raw: unknown, maxItems: number, maxItemLength = 120): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const clean = item.trim().slice(0, maxItemLength);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

function resolveSearchLanguage(lang?: unknown): string {
  return typeof lang === 'string' && ALLOWED_SEARCH_LANGUAGES.has(lang) ? lang : CACHE_LANGUAGE;
}

function checkSlidingRateLimit(
  store: Map<string, number[]>,
  userId: string,
  maxRequests: number,
  windowMs = RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = store.get(userId) ?? [];
  const recent = existing.filter((ts) => ts > cutoff);
  if (recent.length >= maxRequests) {
    store.set(userId, recent);
    return true;
  }
  recent.push(now);
  store.set(userId, recent);
  if (store.size > 1000) {
    for (const [uid, times] of store.entries()) {
      const active = times.filter((ts) => ts > cutoff);
      if (active.length === 0) store.delete(uid);
      else store.set(uid, active);
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerVal: string | null): number {
  if (!headerVal) return 750;
  const seconds = Number.parseFloat(headerVal);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.min(3000, Math.max(300, Math.round(seconds * 1000)));
  }
  return 750;
}

function isFatalTmdbError(err: unknown): err is TmdbApiError {
  return err instanceof TmdbApiError && (err.code === 'TMDB_NOT_CONFIGURED' || err.code === 'TMDB_AUTH_ERROR');
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const readToken = getEnv('TMDB_READ_ACCESS_TOKEN').trim();
  const apiKey = getEnv('TMDB_API_KEY').trim();
  if (!readToken && !apiKey) {
    throw new TmdbApiError(
      'TMDB_NOT_CONFIGURED',
      'TMDB_NOT_CONFIGURED: Сервис распознавания TMDB временно не настроен.'
    );
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }
  if (!readToken && apiKey) {
    if (!warnedLegacyApiKey) {
      warnedLegacyApiKey = true;
      console.warn('[tmdb-proxy] Using TMDB v3 query api_key fallback; prefer v4 Bearer token.');
    }
    url.searchParams.set('api_key', apiKey);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (readToken) {
    headers.Authorization = `Bearer ${readToken}`;
  }

  let rateLimitAttempts = 0;
  let transientAttempts = 0;

  while (true) {
    let res: Response;
    try {
      res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      if (transientAttempts < 1) {
        transientAttempts += 1;
        await sleep(500);
        continue;
      }
      const msg = err instanceof Error ? err.message : 'Network error';
      console.error('[tmdb-proxy] Network failure calling TMDB:', path, msg);
      throw new TmdbApiError('TMDB_NETWORK_ERROR', 'TMDB network error');
    }

    if (res.ok) {
      return (await res.json()) as T;
    }

    const body = await res.text().catch(() => '');

    if (res.status === 401 || res.status === 403) {
      console.error('[tmdb-proxy] TMDB authentication failed:', res.status, body.slice(0, 200));
      throw new TmdbApiError(
        'TMDB_AUTH_ERROR',
        `TMDB auth error (${res.status}): ошибка авторизации внешнего сервиса TMDB.`,
        res.status
      );
    }

    if (res.status === 429 && rateLimitAttempts < 2) {
      const waitMs = parseRetryAfterMs(res.headers.get('Retry-After'));
      rateLimitAttempts += 1;
      console.warn(`[tmdb-proxy] TMDB 429 rate limit on ${path}, retrying in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }

    if ((res.status === 502 || res.status === 503 || res.status === 504) && transientAttempts < 1) {
      transientAttempts += 1;
      console.warn(`[tmdb-proxy] TMDB ${res.status} on ${path}, retrying in 500ms`);
      await sleep(500);
      continue;
    }

    if (res.status === 429) {
      console.error('[tmdb-proxy] TMDB rate limit exhausted:', path, body.slice(0, 200));
      throw new TmdbApiError('TMDB_RATE_LIMITED', 'TMDB rate limited (429)', 429);
    }

    console.error('[tmdb-proxy] TMDB HTTP error:', res.status, path, body.slice(0, 200));
    throw new TmdbApiError('TMDB_HTTP_ERROR', `TMDB HTTP ${res.status}`, res.status);
  }
}

function toPosterUrl(posterPath?: string | null): string | null {
  if (!posterPath || !/^\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(posterPath)) return null;
  return `${TMDB_POSTER_BASE}${posterPath}`;
}

function formatMovieLabel(title: string, year?: number | null): string {
  const clean = title.trim();
  return year ? `${clean} (${year})` : clean;
}

async function verifyCaller(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearerMatch = authHeader.match(/^Bearer\s+(\S+)$/i);
  const token = bearerMatch ? bearerMatch[1].trim() : '';
  if (!token || token.length < 20 || token.length > 4096 || token.split('.').length !== 3) {
    return null;
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const anonKey = resolveNamedApiKey('SUPABASE_PUBLISHABLE_KEYS', ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY']);
  if (!supabaseUrl || !anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Server-verified session check ensures logged-out, deleted, or banned sessions are rejected immediately.
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const userMeta = data.user as { id: string; role?: string; is_anonymous?: boolean };
  if (userMeta.is_anonymous === true || (userMeta.role && userMeta.role !== 'authenticated')) {
    return null;
  }
  return { userId: userMeta.id };
}

function getServiceClient() {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceKey = resolveNamedApiKey('SUPABASE_SECRET_KEYS', ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY is missing in Edge Function environment.');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface TmdbSearchResponse {
  results: Array<
    TmdbSearchCandidate & {
      title: string;
    }
  >;
}

async function handleSearch(reqBody: SearchRequest) {
  const query = typeof reqBody.query === 'string' ? reqBody.query.trim().slice(0, 200) : '';
  if (!query) {
    return { results: [], tmdbConfigured: true };
  }
  if (!isTmdbConfigured()) {
    return { results: [], tmdbConfigured: false };
  }
  const language = resolveSearchLanguage(reqBody.language);
  const validYear =
    typeof reqBody.year === 'number' && Number.isInteger(reqBody.year) && reqBody.year >= 1870 && reqBody.year <= 2100
      ? reqBody.year
      : undefined;
  const data = await tmdbFetch<TmdbSearchResponse>('/search/movie', {
    query,
    year: validYear,
    include_adult: 'false',
    language,
  });

  const results = (data.results ?? []).slice(0, 10).map((m) => ({
    tmdbId: m.id,
    title: m.title,
    originalTitle: m.original_title ?? null,
    releaseYear: parseReleaseYear(m.release_date),
    posterUrl: toPosterUrl(m.poster_path),
    overview: m.overview ?? '',
  }));

  return { results, tmdbConfigured: true };
}

async function searchBestTmdbMovie(
  title: string,
  year?: number | null
): Promise<TmdbSearchCandidate | null> {
  const attempts = buildSearchAttempts(title, year);
  if (attempts.length === 0) return null;

  const allCandidates: TmdbSearchCandidate[] = [];

  for (const attempt of attempts) {
    const data = await tmdbFetch<TmdbSearchResponse>('/search/movie', {
      query: attempt.query,
      year: attempt.year,
      include_adult: 'false',
      language: attempt.language,
    });

    if (Array.isArray(data.results) && data.results.length > 0) {
      allCandidates.push(...data.results);
      const currentBest = pickBestCandidate(allCandidates, title, year);
      if (currentBest?.highConfidence) {
        return currentBest.candidate;
      }
    }
  }

  return pickBestCandidate(allCandidates, title, year)?.candidate ?? null;
}

interface TmdbMovieDetails {
  id: number;
  imdb_id?: string | null;
  title: string;
  original_title?: string | null;
  release_date?: string | null;
  runtime?: number | null;
  poster_path?: string | null;
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  credits?: {
    crew?: Array<{ job?: string; name?: string }>;
  };
}

interface NormalizedTmdbPayload {
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  release_year: number | null;
  runtime_minutes: number | null;
  genres: string[];
  directors: string[];
  countries: string[];
  poster_url: string | null;
}

function normalizeImdbId(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return /^tt[0-9]{5,10}$/.test(trimmed) ? trimmed : null;
}

async function fetchNormalizedTmdbPayload(
  tmdbId: number,
  language = 'ru-RU'
): Promise<NormalizedTmdbPayload> {
  const details = await tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    append_to_response: 'credits',
    language,
  });

  const directors = normalizeDirectors(details.credits?.crew ?? []);
  const genres = normalizeGenres(details.genres ?? []);
  const countries = localizeCountries(details.production_countries ?? []);

  const runtimeMinutes =
    typeof details.runtime === 'number' && details.runtime >= 1 && details.runtime <= 1500
      ? Math.round(details.runtime)
      : null;

  const title = (details.title || details.original_title || `TMDB #${tmdbId}`).slice(0, 500);
  const originalTitle = (details.original_title || details.title || `TMDB #${tmdbId}`).slice(0, 500);

  return {
    tmdb_id: details.id,
    imdb_id: normalizeImdbId(details.imdb_id),
    title,
    original_title: originalTitle,
    release_year: parseReleaseYear(details.release_date),
    runtime_minutes: runtimeMinutes,
    genres,
    directors,
    countries,
    poster_url: toPosterUrl(details.poster_path),
  };
}

async function enrichAndCacheByTmdbId(
  serviceClient: ReturnType<typeof getServiceClient>,
  tmdbId: number,
  language = 'ru-RU',
  options?: { forceRefresh?: boolean }
): Promise<MovieRow> {
  const { data: cached } = await serviceClient
    .from('movies')
    .select(PUBLIC_MOVIE_COLUMNS)
    .eq('tmdb_id', tmdbId)
    .maybeSingle<MovieRow>();

  if (cached && !options?.forceRefresh) {
    const ageMs = Date.now() - new Date(cached.updated_at).getTime();
    if (
      ageMs < CACHE_TTL_MS &&
      cached.runtime_minutes !== null &&
      cached.directors.length > 0 &&
      cached.original_title !== null
    ) {
      return cached;
    }
  }

  const payload = await fetchNormalizedTmdbPayload(tmdbId, language);

  const { data: upserted, error } = await serviceClient
    .from('movies')
    .upsert({ ...payload, created_by: null }, { onConflict: 'tmdb_id' })
    .select(PUBLIC_MOVIE_COLUMNS)
    .single<MovieRow>();

  if (error || !upserted) {
    throw new Error(`Failed to cache TMDB movie ${tmdbId}: ${error?.message ?? 'unknown error'}`);
  }
  return upserted;
}

async function getOrCreateFallbackMovie(
  serviceClient: ReturnType<typeof getServiceClient>,
  item: BatchItem,
  userId: string
): Promise<MovieRow> {
  const cleanTitle = item.title.trim().slice(0, 500);
  if (!cleanTitle) {
    throw new Error('Movie title is required');
  }
  const escapedTitle = escapeIlikePattern(cleanTitle);
  const year =
    typeof item.year === 'number' && Number.isInteger(item.year) && item.year >= 1870 && item.year <= 2100
      ? item.year
      : null;

  // Check if this user's unmatched fallback row already exists for (created_by, lower(title), coalesce(year, 0))
  const query = serviceClient
    .from('movies')
    .select(PUBLIC_MOVIE_COLUMNS)
    .is('tmdb_id', null)
    .eq('created_by', userId)
    .ilike('title', escapedTitle);

  const { data: candidates } = await (year ? query.eq('release_year', year) : query.is('release_year', null));
  if (candidates && candidates.length > 0) {
    return candidates[0] as MovieRow;
  }

  const runtime =
    typeof item.fallbackRuntimeMinutes === 'number' &&
    Number.isFinite(item.fallbackRuntimeMinutes) &&
    item.fallbackRuntimeMinutes >= 1 &&
    item.fallbackRuntimeMinutes <= 1500
      ? Math.round(item.fallbackRuntimeMinutes)
      : null;

  const { data: inserted, error } = await serviceClient
    .from('movies')
    .insert({
      tmdb_id: null,
      imdb_id: normalizeImdbId(item.imdbId),
      title: cleanTitle,
      release_year: year,
      runtime_minutes: runtime,
      genres: normalizeGenres(sanitizeStringList(item.fallbackGenres, 6, 80)),
      directors: sanitizeStringList(item.fallbackDirectors, 5, 120),
      countries: sanitizeStringList(item.fallbackCountries, 5, 80),
      created_by: userId,
    })
    .select(PUBLIC_MOVIE_COLUMNS)
    .single<MovieRow>();

  if (!error && inserted) {
    return inserted;
  }

  if (error?.code === '54000') {
    throw new QuotaExceededError('Превышен лимит нераспознанных фильмов в профиле (максимум 5 000).');
  }

  // Handle race within the same user's own unmatched fallback rows (fail-closed across tenants)
  const retryQuery = serviceClient
    .from('movies')
    .select(PUBLIC_MOVIE_COLUMNS)
    .is('tmdb_id', null)
    .eq('created_by', userId)
    .ilike('title', escapedTitle);
  const { data: retryRows } = await (year
    ? retryQuery.eq('release_year', year)
    : retryQuery.is('release_year', null));

  if (retryRows && retryRows.length > 0) {
    return retryRows[0] as MovieRow;
  }
  throw new Error(`Failed to store fallback movie "${cleanTitle}": ${error?.message ?? 'unknown error'}`);
}

async function findCachedTmdbMovieByTitle(
  serviceClient: ReturnType<typeof getServiceClient>,
  cleanTitle: string,
  year?: number | null
): Promise<MovieRow | null> {
  const escapedTitle = escapeIlikePattern(cleanTitle);
  const validYear =
    typeof year === 'number' && Number.isInteger(year) && year >= 1870 && year <= 2100 ? year : null;

  const titleQuery = serviceClient
    .from('movies')
    .select(PUBLIC_MOVIE_COLUMNS)
    .not('tmdb_id', 'is', null)
    .ilike('title', escapedTitle);
  const { data: byTitle, error: byTitleErr } = await (validYear
    ? titleQuery.eq('release_year', validYear)
    : titleQuery
  ).limit(1);

  if (byTitleErr) {
    console.error('[tmdb-proxy] Cache lookup by title failed:', cleanTitle, byTitleErr.message);
  }
  if (byTitle && byTitle.length > 0) {
    return byTitle[0] as MovieRow;
  }

  const origQuery = serviceClient
    .from('movies')
    .select(PUBLIC_MOVIE_COLUMNS)
    .not('tmdb_id', 'is', null)
    .ilike('original_title', escapedTitle);
  const { data: byOrig, error: byOrigErr } = await (validYear
    ? origQuery.eq('release_year', validYear)
    : origQuery
  ).limit(1);

  if (byOrigErr) {
    console.error('[tmdb-proxy] Cache lookup by original_title failed:', cleanTitle, byOrigErr.message);
  }
  if (byOrig && byOrig.length > 0) {
    return byOrig[0] as MovieRow;
  }

  return null;
}

interface TmdbFindResponse {
  movie_results?: Array<{ id: number }>;
}

interface BatchSharedState {
  fatalErrorCode: TmdbErrorCode | null;
  fatalErrorMessage: string | null;
  lastErrorCode: TmdbErrorCode | null;
  lastErrorMessage: string | null;
}

function recordBatchError(state: BatchSharedState, err: unknown, context: string) {
  if (isFatalTmdbError(err)) {
    state.fatalErrorCode = err.code;
    state.fatalErrorMessage = err.message;
  } else if (err instanceof TmdbApiError) {
    state.lastErrorCode = err.code;
    state.lastErrorMessage = err.message;
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[tmdb-proxy] ${context}:`, msg);
}

async function resolveSingleBatchItem(
  serviceClient: ReturnType<typeof getServiceClient>,
  item: BatchItem,
  language: string,
  state: BatchSharedState,
  userId: string
): Promise<MovieRow> {
  const validTmdbId = parsePositiveInt4(item.tmdbId);
  if (validTmdbId !== null) {
    if (!state.fatalErrorCode) {
      try {
        return await enrichAndCacheByTmdbId(serviceClient, validTmdbId, language);
      } catch (err) {
        recordBatchError(state, err, `enrich by tmdbId=${validTmdbId}`);
      }
    }

    const { data: cachedByTmdb } = await serviceClient
      .from('movies')
      .select(PUBLIC_MOVIE_COLUMNS)
      .eq('tmdb_id', validTmdbId)
      .maybeSingle<MovieRow>();
    if (cachedByTmdb) return cachedByTmdb;
  }

  const imdbId = normalizeImdbId(item.imdbId);
  if (imdbId) {
    const { data: byImdbRows } = await serviceClient
      .from('movies')
      .select(PUBLIC_MOVIE_COLUMNS)
      .not('tmdb_id', 'is', null)
      .eq('imdb_id', imdbId)
      .limit(1);
    const byImdb = (byImdbRows?.[0] as MovieRow | undefined) ?? null;

    if (byImdb) {
      if (byImdb.tmdb_id && byImdb.original_title === null && !state.fatalErrorCode) {
        try {
          return await enrichAndCacheByTmdbId(serviceClient, byImdb.tmdb_id, language, { forceRefresh: true });
        } catch (err) {
          recordBatchError(state, err, `refresh by imdb=${imdbId}`);
        }
      }
      return byImdb;
    }

    if (!state.fatalErrorCode) {
      try {
        const found = await tmdbFetch<TmdbFindResponse>(`/find/${imdbId}`, {
          external_source: 'imdb_id',
          language,
        });
        const firstId = found.movie_results?.[0]?.id;
        if (firstId) {
          return await enrichAndCacheByTmdbId(serviceClient, firstId, language);
        }
      } catch (err) {
        recordBatchError(state, err, `find by imdb=${imdbId}`);
      }
    }
  }

  // Check existing cache by title / original_title + year before hitting TMDB search API
  const cleanTitle = item.title.trim();
  const cachedByTitle = await findCachedTmdbMovieByTitle(serviceClient, cleanTitle, item.year);
  if (cachedByTitle && cachedByTitle.tmdb_id) {
    if (cachedByTitle.original_title === null && !state.fatalErrorCode) {
      try {
        return await enrichAndCacheByTmdbId(serviceClient, cachedByTitle.tmdb_id, language, {
          forceRefresh: true,
        });
      } catch (err) {
        recordBatchError(state, err, `refresh cached "${cleanTitle}"`);
      }
    }
    return cachedByTitle;
  }

  // Try multi-step TMDB search -> enrich
  if (!state.fatalErrorCode) {
    try {
      const bestMatch = await searchBestTmdbMovie(cleanTitle, item.year);
      if (bestMatch?.id) {
        return await enrichAndCacheByTmdbId(serviceClient, bestMatch.id, language);
      }
    } catch (err) {
      recordBatchError(state, err, `search/enrich "${cleanTitle}" (${item.year ?? '?'})`);
    }
  }

  return await getOrCreateFallbackMovie(serviceClient, item, userId);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchUserMovieIds(
  serviceClient: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<string[]> {
  const movieIds = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await serviceClient
      .from('watch_logs')
      .select('movie_id')
      .eq('user_id', userId)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch user watch_logs: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (typeof row.movie_id === 'string') {
        movieIds.add(row.movie_id);
      }
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return Array.from(movieIds);
}

async function mergeFallbackIntoExistingTmdbMovie(
  serviceClient: ReturnType<typeof getServiceClient>,
  fallbackRow: MovieRow,
  existingRow: MovieRow,
  payload: NormalizedTmdbPayload,
  userId: string
): Promise<void> {
  if (existingRow.original_title === null) {
    const { error: refreshErr } = await serviceClient
      .from('movies')
      .update({
        ...payload,
        imdb_id: payload.imdb_id ?? existingRow.imdb_id,
        created_by: null,
      })
      .eq('id', existingRow.id);

    if (refreshErr) {
      console.error('[tmdb-proxy] Failed refreshing existing TMDB movie during merge:', refreshErr.message);
    }
  }

  const { error: repointErr } = await serviceClient
    .from('watch_logs')
    .update({ movie_id: existingRow.id })
    .eq('movie_id', fallbackRow.id)
    .eq('user_id', userId);

  if (repointErr) {
    throw new Error(`Failed to repoint watch_logs from ${fallbackRow.id} to ${existingRow.id}: ${repointErr.message}`);
  }

  const { error: deleteErr } = await serviceClient
    .from('movies')
    .delete()
    .eq('id', fallbackRow.id)
    .is('tmdb_id', null)
    .eq('created_by', userId);

  if (deleteErr) {
    console.warn(`[tmdb-proxy] Could not delete orphan fallback movie ${fallbackRow.id}:`, deleteErr.message);
  }
}

async function handleReenrichUnmatched(
  serviceClient: ReturnType<typeof getServiceClient>,
  userId: string,
  reqBody: ReenrichUnmatchedRequest
) {
  const language = CACHE_LANGUAGE;

  if (!isTmdbConfigured()) {
    return {
      totalProcessed: 0,
      matchedCount: 0,
      mergedCount: 0,
      refreshedCount: 0,
      unmatchedCount: 0,
      tmdbConfigured: false,
      errorCode: 'TMDB_NOT_CONFIGURED' as TmdbErrorCode,
      errorMessage: 'Сервис распознавания TMDB временно не настроен администратором.',
      unmatchedTitles: [] as string[],
    };
  }

  const userMovieIds = await fetchUserMovieIds(serviceClient, userId);
  if (userMovieIds.length === 0) {
    return {
      totalProcessed: 0,
      matchedCount: 0,
      mergedCount: 0,
      refreshedCount: 0,
      unmatchedCount: 0,
      tmdbConfigured: true,
      errorCode: null,
      errorMessage: null,
      unmatchedTitles: [] as string[],
    };
  }

  const userMovieSet = new Set(userMovieIds);
  const requestedIds = Array.isArray(reqBody.movieIds) && reqBody.movieIds.length > 0
    ? Array.from(
        new Set(
          reqBody.movieIds
            .slice(0, 200)
            .filter(
              (id): id is string => typeof id === 'string' && UUID_REGEX.test(id) && userMovieSet.has(id)
            )
        )
      ).slice(0, 40)
    : userMovieIds;

  const rawLimit = typeof reqBody.limit === 'number' && Number.isFinite(reqBody.limit) ? Math.trunc(reqBody.limit) : 25;
  const effectiveLimit = Math.min(40, Math.max(1, rawLimit));

  const candidateRows: InternalMovieRow[] = [];
  for (let i = 0; i < requestedIds.length; i += 100) {
    const idChunk = requestedIds.slice(i, i + 100);
    const { data, error } = await serviceClient
      .from('movies')
      .select(INTERNAL_MOVIE_COLUMNS)
      .in('id', idChunk);

    if (error) {
      throw new Error(`Failed to fetch candidate movies for re-enrich: ${error.message}`);
    }
    for (const row of (data ?? []) as InternalMovieRow[]) {
      if (
        (row.tmdb_id === null && row.created_by === userId) ||
        (row.tmdb_id !== null && row.original_title === null)
      ) {
        candidateRows.push(row);
      }
    }
  }

  // Prioritize unmatched fallback rows (tmdb_id IS NULL) before seeded refresh rows
  candidateRows.sort((a, b) => {
    const aUnmatched = a.tmdb_id === null ? 0 : 1;
    const bUnmatched = b.tmdb_id === null ? 0 : 1;
    return aUnmatched - bUnmatched;
  });

  const targetRows = candidateRows.slice(0, effectiveLimit);
  if (targetRows.length === 0) {
    return {
      totalProcessed: 0,
      matchedCount: 0,
      mergedCount: 0,
      refreshedCount: 0,
      unmatchedCount: 0,
      tmdbConfigured: true,
      errorCode: null,
      errorMessage: null,
      unmatchedTitles: [] as string[],
    };
  }

  let matchedCount = 0;
  let mergedCount = 0;
  let refreshedCount = 0;
  let unmatchedCount = 0;
  const unmatchedTitles: string[] = [];
  let fatalErrorCode: TmdbErrorCode | null = null;
  let fatalErrorMessage: string | null = null;
  let lastErrorCode: TmdbErrorCode | null = null;
  let lastErrorMessage: string | null = null;

  await runWithConcurrency(targetRows, BATCH_CONCURRENCY, async (movieRow) => {
    if (fatalErrorCode) return;

    try {
      if (movieRow.tmdb_id !== null) {
        await enrichAndCacheByTmdbId(serviceClient, movieRow.tmdb_id, language, { forceRefresh: true });
        refreshedCount += 1;
        return;
      }

      if (movieRow.created_by !== userId) {
        return;
      }

      const bestMatch = await searchBestTmdbMovie(movieRow.title, movieRow.release_year);
      if (!bestMatch?.id) {
        unmatchedCount += 1;
        unmatchedTitles.push(formatMovieLabel(movieRow.title, movieRow.release_year));
        return;
      }

      const { data: existingByTmdb } = await serviceClient
        .from('movies')
        .select(PUBLIC_MOVIE_COLUMNS)
        .eq('tmdb_id', bestMatch.id)
        .maybeSingle<MovieRow>();

      if (existingByTmdb && existingByTmdb.id !== movieRow.id) {
        const payload = await fetchNormalizedTmdbPayload(bestMatch.id, language);
        await mergeFallbackIntoExistingTmdbMovie(serviceClient, movieRow, existingByTmdb, payload, userId);
        mergedCount += 1;
        return;
      }

      const canonicalMovie = await enrichAndCacheByTmdbId(serviceClient, bestMatch.id, language);

      const { error: repointErr } = await serviceClient
        .from('watch_logs')
        .update({ movie_id: canonicalMovie.id })
        .eq('movie_id', movieRow.id)
        .eq('user_id', userId);

      if (repointErr) {
        throw new Error(`Failed repointing watch_logs for movie ${movieRow.id}: ${repointErr.message}`);
      }

      const { error: cleanupErr } = await serviceClient
        .from('movies')
        .delete()
        .eq('id', movieRow.id)
        .is('tmdb_id', null)
        .eq('created_by', userId);

      if (cleanupErr) {
        console.warn(`[tmdb-proxy] Could not delete fallback movie ${movieRow.id}:`, cleanupErr.message);
      }

      matchedCount += 1;
      return;
    } catch (err) {
      if (isFatalTmdbError(err)) {
        fatalErrorCode = err.code;
        fatalErrorMessage = err.message;
        console.error('[tmdb-proxy] Fatal TMDB error during re-enrich:', err.message);
        return;
      }

      if (err instanceof TmdbApiError) {
        lastErrorCode = err.code;
        lastErrorMessage = err.message;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[tmdb-proxy] Re-enrich failed for "${movieRow.title}":`, msg);
      if (movieRow.tmdb_id === null) {
        unmatchedCount += 1;
        unmatchedTitles.push(formatMovieLabel(movieRow.title, movieRow.release_year));
      }
    }
  });

  const totalSuccess = matchedCount + mergedCount + refreshedCount;
  return {
    totalProcessed: targetRows.length,
    matchedCount,
    mergedCount,
    refreshedCount,
    unmatchedCount,
    tmdbConfigured: fatalErrorCode !== 'TMDB_NOT_CONFIGURED',
    errorCode: fatalErrorCode ?? (totalSuccess === 0 ? lastErrorCode : null),
    errorMessage: fatalErrorMessage ?? (totalSuccess === 0 ? lastErrorMessage : null),
    unmatchedTitles,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function next() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsContext(req);
  if (!cors.allowed) {
    logSecurityEvent('cors_rejected', { origin: req.headers.get('Origin') ?? 'unknown' });
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: {
        ...cors.headers,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors.headers });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, cors.headers);
  }

  const caller = await verifyCaller(req);
  if (!caller) {
    logSecurityEvent('auth_failed', { origin: req.headers.get('Origin') ?? null });
    return jsonResponse({ error: 'Unauthorized: valid Supabase session required.' }, 401, cors.headers);
  }

  if (checkSlidingRateLimit(userRequestTimestamps, caller.userId, RATE_LIMIT_MAX_REQUESTS)) {
    logSecurityEvent('rate_limited', { userId: caller.userId, scope: 'general' });
    return jsonResponse({ error: 'Too many requests. Please wait a minute and try again.' }, 429, cors.headers);
  }

  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredSize = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declaredSize) && declaredSize > MAX_REQUEST_BODY_BYTES) {
      logSecurityEvent('payload_rejected', { userId: caller.userId, reason: 'content_length_exceeded', declaredSize });
      return jsonResponse({ error: 'Request payload too large' }, 413, cors.headers);
    }
  }

  let body: ProxyRequest;
  try {
    const rawText = await req.text();
    const byteLength = new TextEncoder().encode(rawText).byteLength;
    if (byteLength > MAX_REQUEST_BODY_BYTES) {
      logSecurityEvent('payload_rejected', { userId: caller.userId, reason: 'body_bytes_exceeded', byteLength });
      return jsonResponse({ error: 'Request payload too large' }, 413, cors.headers);
    }
    const parsed = JSON.parse(rawText);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as { action?: unknown }).action !== 'string'
    ) {
      logSecurityEvent('payload_rejected', { userId: caller.userId, reason: 'invalid_shape' });
      return jsonResponse({ error: 'Invalid request payload' }, 400, cors.headers);
    }
    body = parsed as ProxyRequest;
  } catch (err) {
    console.warn('[tmdb-proxy] Invalid JSON request body:', err instanceof Error ? err.message : String(err));
    logSecurityEvent('payload_rejected', { userId: caller.userId, reason: 'invalid_json' });
    return jsonResponse({ error: 'Invalid JSON request body' }, 400, cors.headers);
  }

  try {
    if (body.action === 'search') {
      const res = await handleSearch(body);
      return jsonResponse(res, 200, cors.headers);
    }

    const serviceClient = getServiceClient();

    if (body.action === 'enrich') {
      const tmdbId = parsePositiveInt4(body.tmdbId);
      if (tmdbId === null) {
        return jsonResponse({ error: 'tmdbId must be a valid positive integer' }, 400, cors.headers);
      }
      const movie = await enrichAndCacheByTmdbId(serviceClient, tmdbId, CACHE_LANGUAGE);
      logSecurityEvent('cache_write', { userId: caller.userId, action: 'enrich', tmdbId });
      return jsonResponse({ movie }, 200, cors.headers);
    }

    if (body.action === 'resolve_batch') {
      if (checkSlidingRateLimit(heavyRequestTimestamps, caller.userId, HEAVY_RATE_LIMIT_MAX_REQUESTS)) {
        logSecurityEvent('rate_limited', { userId: caller.userId, scope: 'resolve_batch' });
        return jsonResponse({ error: 'Too many batch requests. Please wait a minute and try again.' }, 429, cors.headers);
      }

      const rawItems = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
      const items: BatchItem[] = rawItems
        .filter(
          (it): it is BatchItem =>
            typeof it === 'object' &&
            it !== null &&
            typeof (it as { title?: unknown }).title === 'string' &&
            (it as { title: string }).title.trim().length > 0
        )
        .map((it) => ({
          title: it.title.trim().slice(0, 500),
          year: typeof it.year === 'number' && Number.isInteger(it.year) ? it.year : null,
          tmdbId: parsePositiveInt4(it.tmdbId),
          imdbId: typeof it.imdbId === 'string' ? it.imdbId : null,
          fallbackRuntimeMinutes:
            typeof it.fallbackRuntimeMinutes === 'number' && Number.isFinite(it.fallbackRuntimeMinutes)
              ? it.fallbackRuntimeMinutes
              : null,
          fallbackGenres: sanitizeStringList(it.fallbackGenres, 6, 80),
          fallbackDirectors: sanitizeStringList(it.fallbackDirectors, 5, 120),
          fallbackCountries: sanitizeStringList(it.fallbackCountries, 5, 80),
        }));

      if (items.length === 0) {
        return jsonResponse(
          {
            movies: [],
            stats: {
              total: 0,
              matched: 0,
              unmatched: 0,
              tmdbConfigured: isTmdbConfigured(),
              errorCode: null,
              errorMessage: null,
              unmatchedTitles: [],
            },
          },
          200,
          cors.headers
        );
      }

      const language = CACHE_LANGUAGE;
      const configured = isTmdbConfigured();
      const sharedState: BatchSharedState = {
        fatalErrorCode: configured ? null : 'TMDB_NOT_CONFIGURED',
        fatalErrorMessage: configured
          ? null
          : 'Сервис распознавания TMDB временно не настроен администратором.',
        lastErrorCode: null,
        lastErrorMessage: null,
      };

      const movies = await runWithConcurrency(items, BATCH_CONCURRENCY, (item) =>
        resolveSingleBatchItem(serviceClient, item, language, sharedState, caller.userId)
      );

      let matched = 0;
      const unmatchedTitles: string[] = [];
      movies.forEach((movie, idx) => {
        if (movie.tmdb_id !== null) {
          matched += 1;
        } else {
          const item = items[idx];
          unmatchedTitles.push(formatMovieLabel(item?.title ?? movie.title, item?.year ?? movie.release_year));
        }
      });

      const stats = {
        total: movies.length,
        matched,
        unmatched: movies.length - matched,
        tmdbConfigured: sharedState.fatalErrorCode !== 'TMDB_NOT_CONFIGURED',
        errorCode:
          sharedState.fatalErrorCode ?? (matched === 0 && movies.length > 0 ? sharedState.lastErrorCode : null),
        errorMessage:
          sharedState.fatalErrorMessage ?? (matched === 0 && movies.length > 0 ? sharedState.lastErrorMessage : null),
        unmatchedTitles,
      };

      logSecurityEvent('cache_write', {
        userId: caller.userId,
        action: 'resolve_batch',
        total: movies.length,
        matched,
        unmatched: movies.length - matched,
      });

      return jsonResponse({ movies, stats }, 200, cors.headers);
    }

    if (body.action === 'reenrich_unmatched') {
      if (checkSlidingRateLimit(heavyRequestTimestamps, caller.userId, HEAVY_RATE_LIMIT_MAX_REQUESTS)) {
        logSecurityEvent('rate_limited', { userId: caller.userId, scope: 'reenrich_unmatched' });
        return jsonResponse({ error: 'Too many re-enrich requests. Please wait a minute and try again.' }, 429, cors.headers);
      }
      const result = await handleReenrichUnmatched(serviceClient, caller.userId, body);
      logSecurityEvent('cache_write', {
        userId: caller.userId,
        action: 'reenrich_unmatched',
        totalProcessed: result.totalProcessed,
        matchedCount: result.matchedCount,
        mergedCount: result.mergedCount,
        refreshedCount: result.refreshedCount,
      });
      return jsonResponse(result, 200, cors.headers);
    }

    return jsonResponse({ error: 'Unknown action' }, 400, cors.headers);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      logSecurityEvent('quota_exceeded', { userId: caller.userId, action: body.action });
      return jsonResponse({ error: err.message, code: 'QUOTA_EXCEEDED' }, 429, cors.headers);
    }
    if (isFatalTmdbError(err)) {
      console.error('[tmdb-proxy] Fatal TMDB error:', err.code, err.message);
      return jsonResponse({ error: err.message, code: err.code }, err.status ?? 502, cors.headers);
    }
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    console.error('[tmdb-proxy] Unexpected error:', message);
    return jsonResponse({ error: 'Internal server error in tmdb-proxy' }, 500, cors.headers);
  }
});
