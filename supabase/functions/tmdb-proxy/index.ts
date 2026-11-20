import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BATCH_CONCURRENCY = 4;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

type ProxyRequest = SearchRequest | EnrichRequest | ResolveBatchRequest;

function jsonResponse(payload: unknown, status = 200): Response {
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

async function tmdbFetch<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const readToken = getEnv('TMDB_READ_ACCESS_TOKEN');
  const apiKey = getEnv('TMDB_API_KEY');
  if (!readToken && !apiKey) {
    throw new Error('TMDB_NOT_CONFIGURED: Set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY in Edge Function secrets.');
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }
  if (!readToken && apiKey) {
    url.searchParams.set('api_key', apiKey);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (readToken) {
    headers.Authorization = `Bearer ${readToken}`;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TMDB HTTP ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

function parseReleaseYear(releaseDate?: string | null): number | null {
  if (!releaseDate || releaseDate.length < 4) return null;
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  if (Number.isNaN(year) || year < 1870 || year > 2100) return null;
  return year;
}

function toPosterUrl(posterPath?: string | null): string | null {
  if (!posterPath || !posterPath.startsWith('/')) return null;
  return `${TMDB_POSTER_BASE}${posterPath}`;
}

async function verifyCaller(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const supabaseUrl = getEnv('SUPABASE_URL');
  const anonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prefer getClaims() for asymmetric JWT signing keys; fall back to getUser() if unavailable.
  const authAny = authClient.auth as unknown as {
    getClaims?: (jwt?: string) => Promise<{ data?: { claims?: { sub?: string } } | null; error: unknown }>;
    getUser: (jwt?: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };

  if (typeof authAny.getClaims === 'function') {
    const { data, error } = await authAny.getClaims(token);
    const sub = data?.claims?.sub;
    if (!error && sub) {
      return { userId: sub };
    }
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id };
}

function getServiceClient() {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in Edge Function environment.');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface TmdbSearchResponse {
  results: Array<{
    id: number;
    title: string;
    original_title?: string;
    release_date?: string;
    poster_path?: string | null;
    overview?: string;
    popularity?: number;
  }>;
}

async function handleSearch(reqBody: SearchRequest) {
  const query = (reqBody.query ?? '').trim();
  if (!query) {
    return { results: [], tmdbConfigured: true };
  }
  if (!getEnv('TMDB_READ_ACCESS_TOKEN') && !getEnv('TMDB_API_KEY')) {
    return { results: [], tmdbConfigured: false };
  }
  const language = reqBody.language ?? 'ru-RU';
  const data = await tmdbFetch<TmdbSearchResponse>('/search/movie', {
    query,
    year: reqBody.year ?? undefined,
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

  return { results };
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

function normalizeImdbId(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return /^tt[0-9]{5,10}$/.test(trimmed) ? trimmed : null;
}

async function enrichAndCacheByTmdbId(
  serviceClient: ReturnType<typeof getServiceClient>,
  tmdbId: number,
  language = 'ru-RU'
): Promise<MovieRow> {
  const { data: cached } = await serviceClient
    .from('movies')
    .select('*')
    .eq('tmdb_id', tmdbId)
    .maybeSingle<MovieRow>();

  if (cached) {
    const ageMs = Date.now() - new Date(cached.updated_at).getTime();
    if (ageMs < CACHE_TTL_MS && cached.runtime_minutes !== null && cached.directors.length > 0) {
      return cached;
    }
  }

  const details = await tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    append_to_response: 'credits',
    language,
  });

  const directors = Array.from(
    new Set(
      (details.credits?.crew ?? [])
        .filter((c) => c.job === 'Director' && typeof c.name === 'string' && c.name.trim())
        .map((c) => c.name!.trim())
    )
  ).slice(0, 5);

  const genres = (details.genres ?? [])
    .map((g) => g.name.trim())
    .filter(Boolean)
    .slice(0, 6);

  const countries = (details.production_countries ?? [])
    .map((c) => c.name.trim())
    .filter(Boolean)
    .slice(0, 5);

  const runtimeMinutes =
    typeof details.runtime === 'number' && details.runtime >= 1 && details.runtime <= 1500
      ? Math.round(details.runtime)
      : null;

  const payload = {
    tmdb_id: details.id,
    imdb_id: normalizeImdbId(details.imdb_id),
    title: (details.title || details.original_title || `TMDB #${tmdbId}`).slice(0, 500),
    original_title: details.original_title ? details.original_title.slice(0, 500) : null,
    release_year: parseReleaseYear(details.release_date),
    runtime_minutes: runtimeMinutes,
    genres,
    directors,
    countries,
    poster_url: toPosterUrl(details.poster_path),
  };

  const { data: upserted, error } = await serviceClient
    .from('movies')
    .upsert(payload, { onConflict: 'tmdb_id' })
    .select('*')
    .single<MovieRow>();

  if (error || !upserted) {
    throw new Error(`Failed to cache TMDB movie ${tmdbId}: ${error?.message ?? 'unknown error'}`);
  }
  return upserted;
}

async function getOrCreateFallbackMovie(
  serviceClient: ReturnType<typeof getServiceClient>,
  item: BatchItem
): Promise<MovieRow> {
  const cleanTitle = item.title.trim().slice(0, 500);
  const year = item.year && item.year >= 1870 && item.year <= 2100 ? item.year : null;

  // Check if an unmatched fallback row already exists for (lower(title), coalesce(year, 0))
  const query = serviceClient
    .from('movies')
    .select('*')
    .is('tmdb_id', null)
    .ilike('title', cleanTitle);

  const { data: candidates } = await (year ? query.eq('release_year', year) : query.is('release_year', null));
  if (candidates && candidates.length > 0) {
    return candidates[0] as MovieRow;
  }

  const runtime =
    item.fallbackRuntimeMinutes &&
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
      genres: (item.fallbackGenres ?? []).filter(Boolean).slice(0, 6),
      directors: (item.fallbackDirectors ?? []).filter(Boolean).slice(0, 5),
      countries: (item.fallbackCountries ?? []).filter(Boolean).slice(0, 5),
    })
    .select('*')
    .single<MovieRow>();

  if (!error && inserted) {
    return inserted;
  }

  // Handle race on partial unique index movies_unmatched_title_year_key
  const retryQuery = serviceClient
    .from('movies')
    .select('*')
    .is('tmdb_id', null)
    .ilike('title', cleanTitle);
  const { data: retryRows } = await (year
    ? retryQuery.eq('release_year', year)
    : retryQuery.is('release_year', null));

  if (retryRows && retryRows.length > 0) {
    return retryRows[0] as MovieRow;
  }
  throw new Error(`Failed to store fallback movie "${cleanTitle}": ${error?.message ?? 'unknown error'}`);
}

interface TmdbFindResponse {
  movie_results?: Array<{ id: number }>;
}

async function resolveSingleBatchItem(
  serviceClient: ReturnType<typeof getServiceClient>,
  item: BatchItem,
  language: string
): Promise<MovieRow> {
  if (item.tmdbId && item.tmdbId > 0) {
    try {
      return await enrichAndCacheByTmdbId(serviceClient, item.tmdbId, language);
    } catch {
      const { data: cachedByTmdb } = await serviceClient
        .from('movies')
        .select('*')
        .eq('tmdb_id', item.tmdbId)
        .maybeSingle<MovieRow>();
      if (cachedByTmdb) return cachedByTmdb;

      const { data: upserted } = await serviceClient
        .from('movies')
        .upsert(
          {
            tmdb_id: item.tmdbId,
            imdb_id: normalizeImdbId(item.imdbId),
            title: item.title.trim().slice(0, 500),
            release_year: item.year && item.year >= 1870 && item.year <= 2100 ? item.year : null,
            runtime_minutes:
              item.fallbackRuntimeMinutes &&
              item.fallbackRuntimeMinutes >= 1 &&
              item.fallbackRuntimeMinutes <= 1500
                ? Math.round(item.fallbackRuntimeMinutes)
                : null,
            genres: (item.fallbackGenres ?? []).filter(Boolean).slice(0, 6),
            directors: (item.fallbackDirectors ?? []).filter(Boolean).slice(0, 5),
            countries: (item.fallbackCountries ?? []).filter(Boolean).slice(0, 5),
          },
          { onConflict: 'tmdb_id' }
        )
        .select('*')
        .maybeSingle<MovieRow>();
      if (upserted) return upserted;
    }
  }

  const imdbId = normalizeImdbId(item.imdbId);
  if (imdbId) {
    const { data: byImdb } = await serviceClient
      .from('movies')
      .select('*')
      .eq('imdb_id', imdbId)
      .maybeSingle<MovieRow>();
    if (byImdb) return byImdb;

    try {
      const found = await tmdbFetch<TmdbFindResponse>(`/find/${imdbId}`, {
        external_source: 'imdb_id',
        language,
      });
      const firstId = found.movie_results?.[0]?.id;
      if (firstId) {
        return await enrichAndCacheByTmdbId(serviceClient, firstId, language);
      }
    } catch {
      // Fall through to title search / fallback row
    }
  }

  // Check existing cache by title + year before hitting TMDB API
  const cleanTitle = item.title.trim();
  const q = serviceClient.from('movies').select('*').ilike('title', cleanTitle);
  const { data: cachedByTitle } = await (item.year ? q.eq('release_year', item.year) : q).limit(1);
  if (cachedByTitle && cachedByTitle.length > 0 && cachedByTitle[0].tmdb_id) {
    return cachedByTitle[0] as MovieRow;
  }

  // Try TMDB search -> enrich
  try {
    const searchRes = await tmdbFetch<TmdbSearchResponse>('/search/movie', {
      query: cleanTitle,
      year: item.year ?? undefined,
      include_adult: 'false',
      language,
    });
    const bestMatch = searchRes.results?.[0];
    if (bestMatch?.id) {
      return await enrichAndCacheByTmdbId(serviceClient, bestMatch.id, language);
    }
  } catch {
    // Graceful fallback if TMDB token is missing or rate-limited
  }

  return await getOrCreateFallbackMovie(serviceClient, item);
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const caller = await verifyCaller(req);
  if (!caller) {
    return jsonResponse({ error: 'Unauthorized: valid Supabase session JWT required.' }, 401);
  }

  let body: ProxyRequest;
  try {
    body = (await req.json()) as ProxyRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body' }, 400);
  }

  try {
    if (body.action === 'search') {
      const res = await handleSearch(body);
      return jsonResponse(res);
    }

    const serviceClient = getServiceClient();

    if (body.action === 'enrich') {
      if (!Number.isInteger(body.tmdbId) || body.tmdbId <= 0) {
        return jsonResponse({ error: 'tmdbId must be a positive integer' }, 400);
      }
      const movie = await enrichAndCacheByTmdbId(serviceClient, body.tmdbId, body.language ?? 'ru-RU');
      return jsonResponse({ movie });
    }

    if (body.action === 'resolve_batch') {
      const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
      const language = body.language ?? 'ru-RU';
      const movies = await runWithConcurrency(items, BATCH_CONCURRENCY, (item) =>
        resolveSingleBatchItem(serviceClient, item, language)
      );
      return jsonResponse({ movies });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return jsonResponse({ error: message }, 500);
  }
});
