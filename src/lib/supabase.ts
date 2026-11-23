import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import {
  getAuthRedirectUrl,
  localizeAuthError,
  parseGoogleProviderEnabled,
} from './authHelpers';
import { extractEdgeFunctionErrorMessage } from './edgeFunctionError';
import type {
  MovieRecord,
  ParsedImportRow,
  ProfileRecord,
  ReenrichSummary,
  TmdbBatchStats,
  TmdbSearchResult,
  WatchEntry,
  WatchSource,
} from '../types/cinelog';

import { isSupabaseConfigured, supabaseKey, supabaseUrl } from './supabaseConfig';
import {
  halfStarsToRating,
  isValidWatchLogId,
  minutesToTimeString,
  ratingToHalfStars,
  timeStringToMinutes,
} from './watchLogCodec';

export { isSupabaseConfigured };

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  return supabase;
}

export async function getActiveSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function getVerifiedUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export function onAuthChanged(
  callback: (user: User | null, event?: AuthChangeEvent) => void
): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null, event);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmail(email: string, password: string) {
  const client = requireClient();
  return client.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string, username?: string) {
  const client = requireClient();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        username: username?.trim() || undefined,
        timezone,
      },
    },
  });
}

export async function isGoogleProviderEnabled(
  fetchImpl: typeof fetch = fetch
): Promise<boolean | null> {
  if (!isSupabaseConfigured) return false;
  try {
    const response = await fetchImpl(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: {
        apikey: supabaseKey,
      },
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return parseGoogleProviderEnabled(payload);
  } catch {
    return null;
  }
}

export async function signInWithGoogle() {
  const client = requireClient();
  const googleEnabled = await isGoogleProviderEnabled();
  if (googleEnabled === false) {
    return {
      data: null,
      error: new Error(localizeAuthError('Unsupported provider: provider is not enabled')),
    };
  }

  return client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
}

export async function resetPasswordByEmail(email: string) {
  const client = requireClient();
  return client.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });
}

export async function updateAccountPassword(newPassword: string) {
  const client = requireClient();
  const res = await client.auth.updateUser({
    password: newPassword,
  });
  if (!res.error) {
    await client.auth.signOut({ scope: 'others' }).catch(() => undefined);
  }
  return res;
}

export async function signOutAccount() {
  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } finally {
    if (typeof window !== 'undefined') {
      for (const storage of [window.localStorage, window.sessionStorage]) {
        try {
          const keysToRemove: string[] = [];
          for (let i = 0; i < storage.length; i += 1) {
            const key = storage.key(i);
            if (key && /^sb-.*-auth-token/.test(key)) {
              keysToRemove.push(key);
            }
          }
          for (const key of keysToRemove) {
            storage.removeItem(key);
          }
        } catch {
          // Ignore storage access errors in restricted browser contexts
        }
      }
    }
  }
}

export async function fetchUserProfile(userId: string): Promise<ProfileRecord | null> {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('id, username, timezone, preferences')
    .eq('id', userId)
    .maybeSingle<ProfileRecord>();
  if (error) return null;
  return data;
}

interface WatchEntryRow {
  id: number | string;
  movie_id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  release_year: number | null;
  watched_date: string;
  watched_time_min?: number | null;
  watched_time: string | null;
  rating_x2?: number | null;
  rating: number | string | null;
  is_rewatch: boolean;
  source: WatchSource;
  runtime_minutes: number | null;
  runtime_override_minutes: number | null;
  genres: string[] | null;
  directors: string[] | null;
  countries: string[] | null;
  poster_url: string | null;
  import_key: string | null;
  created_at: string;
}

function mapRowToWatchEntry(row: WatchEntryRow): WatchEntry {
  const compactRating = halfStarsToRating(row.rating_x2);
  const parsedRating =
    row.rating === null || row.rating === undefined ? null : Number.parseFloat(String(row.rating));
  const rating =
    compactRating ?? (parsedRating !== null && !Number.isNaN(parsedRating) ? parsedRating : null);

  return {
    id: String(row.id),
    movie_id: row.movie_id,
    tmdb_id: row.tmdb_id,
    imdb_id: row.imdb_id,
    title: row.title,
    original_title: row.original_title,
    release_year: row.release_year,
    watched_date: row.watched_date,
    watched_time: row.watched_time ?? minutesToTimeString(row.watched_time_min),
    rating,
    is_rewatch: row.is_rewatch,
    source: row.source,
    runtime_minutes: row.runtime_minutes,
    runtime_override_minutes: row.runtime_override_minutes,
    genres: row.genres ?? [],
    directors: row.directors ?? [],
    countries: row.countries ?? [],
    poster_url: row.poster_url,
    import_key: row.import_key,
    created_at: row.created_at,
  };
}

const WATCH_ENTRIES_PAGE_SIZE = 1000;

export async function fetchWatchEntries(): Promise<WatchEntry[]> {
  const client = requireClient();
  const rows: WatchEntryRow[] = [];

  for (let from = 0; ; from += WATCH_ENTRIES_PAGE_SIZE) {
    const to = from + WATCH_ENTRIES_PAGE_SIZE - 1;
    const { data, error } = await client
      .from('watch_entries')
      .select('*')
      .order('watched_date', { ascending: false })
      .order('watched_time_min', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Не удалось загрузить просмотры: ${error.message}`);
    }

    const batch = (data as WatchEntryRow[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < WATCH_ENTRIES_PAGE_SIZE) {
      break;
    }
  }

  return rows.map(mapRowToWatchEntry);
}

export async function searchTmdbViaProxy(query: string, year?: number | null): Promise<TmdbSearchResult[]> {
  if (!supabase || !query.trim()) return [];
  const { data, error } = await supabase.functions.invoke<{ results: TmdbSearchResult[] }>('tmdb-proxy', {
    body: { action: 'search', query: query.trim(), year: year ?? undefined, language: 'ru-RU' },
  });
  if (error || !data?.results) {
    return [];
  }
  return data.results;
}

export async function enrichMovieViaProxy(tmdbId: number): Promise<MovieRecord | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke<{ movie: MovieRecord }>('tmdb-proxy', {
    body: { action: 'enrich', tmdbId, language: 'ru-RU' },
  });
  if (error || !data?.movie) return null;
  return data.movie;
}

export interface CreateWatchLogInput {
  tmdbId?: number | null;
  title: string;
  releaseYear: number | null;
  watchedDate: string;
  watchedTime: string | null;
  rating: number | null;
  runtimeMinutes: number | null;
  isRewatch: boolean;
  directors?: string[];
  countries?: string[];
  genres?: string[];
}

export async function insertManualWatchLog(input: CreateWatchLogInput): Promise<WatchEntry> {
  const client = requireClient();

  // Resolve movie_id through tmdb-proxy Edge Function (uses Service Role to write shared movies cache)
  const {
    data: resolved,
    error: resolveError,
    response,
  } = await client.functions.invoke<{
    movies: MovieRecord[];
  }>('tmdb-proxy', {
    body: {
      action: 'resolve_batch',
      language: 'ru-RU',
      items: [
        {
          title: input.title,
          year: input.releaseYear,
          tmdbId: input.tmdbId ?? null,
          fallbackRuntimeMinutes: input.runtimeMinutes,
          fallbackDirectors: input.directors ?? [],
          fallbackCountries: input.countries ?? [],
          fallbackGenres: input.genres ?? [],
        },
      ],
    },
  });

  if (resolveError || !resolved?.movies?.length) {
    const detail = resolveError
      ? await extractEdgeFunctionErrorMessage(
          resolveError,
          'Не удалось сохранить метаданные фильма через Edge Function.',
          response
        )
      : 'Не удалось сохранить метаданные фильма через Edge Function.';
    throw new Error(detail);
  }

  const movie = resolved.movies[0];
  const runtimeOverride =
    input.runtimeMinutes && input.runtimeMinutes !== movie.runtime_minutes ? input.runtimeMinutes : null;

  const { data: inserted, error: insertError } = await client
    .from('watch_logs')
    .insert({
      movie_id: movie.id,
      watched_date: input.watchedDate,
      watched_time_min: timeStringToMinutes(input.watchedTime),
      rating_x2: ratingToHalfStars(input.rating),
      is_rewatch: input.isRewatch,
      source: 'manual',
      runtime_override_minutes: runtimeOverride,
    })
    .select('id')
    .single<{ id: number | string }>();

  if (insertError || !inserted) {
    if (insertError?.code === '54000') {
      throw new Error('Превышен лимит записей (максимум 10 000 просмотров на аккаунт).');
    }
    throw new Error(`Ошибка сохранения просмотра: ${insertError?.message ?? 'unknown'}`);
  }

  const { data: entryRow, error: viewError } = await client
    .from('watch_entries')
    .select('*')
    .eq('id', inserted.id)
    .single<WatchEntryRow>();

  if (viewError || !entryRow) {
    throw new Error(`Просмотр сохранён, но не удалось перечитать запись: ${viewError?.message ?? 'unknown'}`);
  }

  return mapRowToWatchEntry(entryRow);
}

export async function updateWatchLogById(
  logId: string,
  existingEntry: WatchEntry,
  input: CreateWatchLogInput
): Promise<WatchEntry> {
  if (!isValidWatchLogId(logId)) {
    throw new Error('Некорректный идентификатор записи.');
  }
  const client = requireClient();

  const cleanTitle = input.title.trim();
  const titleChanged = cleanTitle !== existingEntry.title.trim();
  const releaseYearChanged = (input.releaseYear ?? null) !== (existingEntry.release_year ?? null);
  const tmdbIdChanged = (input.tmdbId ?? null) !== (existingEntry.tmdb_id ?? null);
  const needsMovieResolve = titleChanged || releaseYearChanged || tmdbIdChanged;

  let targetMovieId = existingEntry.movie_id;
  let runtimeOverride: number | null = existingEntry.runtime_override_minutes;

  if (needsMovieResolve) {
    const {
      data: resolved,
      error: resolveError,
      response,
    } = await client.functions.invoke<{
      movies: MovieRecord[];
    }>('tmdb-proxy', {
      body: {
        action: 'resolve_batch',
        language: 'ru-RU',
        items: [
          {
            title: cleanTitle,
            year: input.releaseYear,
            tmdbId: input.tmdbId ?? null,
            fallbackRuntimeMinutes: input.runtimeMinutes,
            fallbackDirectors: input.directors ?? [],
            fallbackCountries: input.countries ?? [],
            fallbackGenres: input.genres ?? [],
          },
        ],
      },
    });

    if (resolveError || !resolved?.movies?.length) {
      const detail = resolveError
        ? await extractEdgeFunctionErrorMessage(
            resolveError,
            'Не удалось обновить метаданные фильма через Edge Function.',
            response
          )
        : 'Не удалось обновить метаданные фильма через Edge Function.';
      throw new Error(detail);
    }

    const movie = resolved.movies[0];
    targetMovieId = movie.id;
    runtimeOverride =
      input.runtimeMinutes && input.runtimeMinutes !== movie.runtime_minutes ? input.runtimeMinutes : null;
  } else if (input.runtimeMinutes !== existingEntry.runtime_minutes) {
    runtimeOverride = input.runtimeMinutes ?? null;
  }

  const { error: updateError } = await client
    .from('watch_logs')
    .update({
      movie_id: targetMovieId,
      watched_date: input.watchedDate,
      watched_time_min: timeStringToMinutes(input.watchedTime),
      rating_x2: ratingToHalfStars(input.rating),
      is_rewatch: input.isRewatch,
      runtime_override_minutes: runtimeOverride,
    })
    .eq('id', logId.trim());

  if (updateError) {
    throw new Error(`Ошибка обновления просмотра: ${updateError.message}`);
  }

  const { data: entryRow, error: viewError } = await client
    .from('watch_entries')
    .select('*')
    .eq('id', logId.trim())
    .single<WatchEntryRow>();

  if (viewError || !entryRow) {
    throw new Error(`Запись обновлена, но не удалось перечитать данные: ${viewError?.message ?? 'unknown'}`);
  }

  return mapRowToWatchEntry(entryRow);
}

export async function deleteWatchLogById(logId: string): Promise<void> {
  if (!isValidWatchLogId(logId)) {
    throw new Error('Некорректный идентификатор записи.');
  }
  const client = requireClient();
  const { error } = await client.from('watch_logs').delete().eq('id', logId.trim());
  if (error) {
    throw new Error(`Не удалось удалить запись: ${error.message}`);
  }
}

export interface BatchImportResult {
  importedCount: number;
  moviesResolved: number;
  matchedMovies: number;
  unmatchedMovies: number;
  tmdbConfigured: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  unmatchedTitles: string[];
}

export async function batchUpsertImportedRows(
  rows: ParsedImportRow[],
  onProgress?: (processed: number, total: number) => void
): Promise<BatchImportResult> {
  const client = requireClient();
  const nonDuplicates = rows.filter((r) => !r.isDuplicate);
  if (!nonDuplicates.length) {
    return {
      importedCount: 0,
      moviesResolved: 0,
      matchedMovies: 0,
      unmatchedMovies: 0,
      tmdbConfigured: true,
      errorCode: null,
      errorMessage: null,
      unmatchedTitles: [],
    };
  }

  // Deduplicate unique movie lookup descriptors across the import batch
  const descriptorMap = new Map<
    string,
    {
      title: string;
      year: number | null;
      tmdbId: number | null;
      imdbId: string | null;
      fallbackRuntimeMinutes: number | null;
      fallbackGenres: string[];
      fallbackDirectors: string[];
      fallbackCountries: string[];
    }
  >();

  const rowToDescriptorKey = (r: ParsedImportRow) =>
    r.imdbId
      ? `imdb:${r.imdbId}`
      : r.tmdbId
        ? `tmdb:${r.tmdbId}`
        : `ty:${r.title.trim().toLowerCase()}:${r.releaseYear ?? 0}`;

  for (const r of nonDuplicates) {
    const key = rowToDescriptorKey(r);
    if (!descriptorMap.has(key)) {
      descriptorMap.set(key, {
        title: r.title,
        year: r.releaseYear,
        tmdbId: r.tmdbId,
        imdbId: r.imdbId,
        fallbackRuntimeMinutes: r.runtimeMinutes,
        fallbackGenres: r.genres,
        fallbackDirectors: r.directors,
        fallbackCountries: r.countries,
      });
    }
  }

  const descriptorKeys = Array.from(descriptorMap.keys());
  const descriptorItems = Array.from(descriptorMap.values());
  const resolvedMovieByKey = new Map<string, MovieRecord>();

  let tmdbConfigured = true;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  const unmatchedTitles: string[] = [];

  // Resolve movies in chunks of 40 via tmdb-proxy Edge Function
  const CHUNK_SIZE = 40;
  for (let i = 0; i < descriptorItems.length; i += CHUNK_SIZE) {
    const chunkItems = descriptorItems.slice(i, i + CHUNK_SIZE);
    const chunkKeys = descriptorKeys.slice(i, i + CHUNK_SIZE);
    const { data, error, response } = await client.functions.invoke<{
      movies: MovieRecord[];
      stats?: TmdbBatchStats;
    }>('tmdb-proxy', {
      body: {
        action: 'resolve_batch',
        items: chunkItems,
        language: 'ru-RU',
      },
    });
    if (error || !data?.movies) {
      const chunkStart = i + 1;
      const chunkEnd = Math.min(i + chunkItems.length, descriptorItems.length);
      const detail = error
        ? await extractEdgeFunctionErrorMessage(
            error,
            'Ошибка обогащения метаданных при импорте.',
            response
          )
        : 'Ошибка обогащения метаданных при импорте.';
      throw new Error(`Ошибка на этапе ${chunkStart}–${chunkEnd} из ${descriptorItems.length}: ${detail}`);
    }
    data.movies.forEach((movie, idx) => {
      resolvedMovieByKey.set(chunkKeys[idx], movie);
    });
    if (data.stats) {
      if (!data.stats.tmdbConfigured) tmdbConfigured = false;
      if (!errorCode && data.stats.errorCode) {
        errorCode = data.stats.errorCode;
        errorMessage = data.stats.errorMessage;
      }
      if (Array.isArray(data.stats.unmatchedTitles)) {
        unmatchedTitles.push(...data.stats.unmatchedTitles);
      }
    }
    onProgress?.(Math.min(i + chunkItems.length, descriptorItems.length), descriptorItems.length);
  }

  let matchedMovies = 0;
  let unmatchedMovies = 0;
  for (const movie of resolvedMovieByKey.values()) {
    if (movie.tmdb_id !== null) matchedMovies += 1;
    else unmatchedMovies += 1;
  }

  const { data: userData } = await client.auth.getUser();
  if (!userData.user?.id) {
    throw new Error('Пользователь не авторизован.');
  }

  const payload = nonDuplicates.map((r) => {
    const movie = resolvedMovieByKey.get(rowToDescriptorKey(r));
    if (!movie) {
      throw new Error(`Не найден movie_id для фильма "${r.title}".`);
    }
    const runtimeOverride =
      r.runtimeMinutes && r.runtimeMinutes !== movie.runtime_minutes ? r.runtimeMinutes : null;

    return {
      movie_id: movie.id,
      watched_date: r.watchedDate,
      watched_time_min: timeStringToMinutes(r.watchedTime),
      rating_x2: ratingToHalfStars(r.rating),
      is_rewatch: r.isRewatch,
      source: r.source,
      runtime_override_minutes: runtimeOverride,
      import_key: r.importKey,
    };
  });

  // Batch upsert via SECURITY INVOKER RPC (supports partial unique index on user_id + import_key_hash)
  const UPSERT_CHUNK = 200;
  for (let i = 0; i < payload.length; i += UPSERT_CHUNK) {
    const slice = payload.slice(i, i + UPSERT_CHUNK);
    const { error } = await client.rpc('upsert_watch_logs', { p_rows: slice });
    if (error) {
      if (error.code === '54000') {
        throw new Error('Превышен лимит записей (максимум 10 000 просмотров на аккаунт).');
      }
      throw new Error(`Ошибка пакетного сохранения в Supabase: ${error.message}`);
    }
  }

  return {
    importedCount: payload.length,
    moviesResolved: resolvedMovieByKey.size,
    matchedMovies,
    unmatchedMovies,
    tmdbConfigured,
    errorCode,
    errorMessage,
    unmatchedTitles,
  };
}

export async function reenrichUserMovies(
  movieIds: string[],
  onProgress?: (done: number, total: number) => void
): Promise<ReenrichSummary> {
  const client = requireClient();
  const uniqueIds = Array.from(new Set(movieIds.filter((id) => typeof id === 'string' && id.trim())));

  const summary: ReenrichSummary = {
    totalProcessed: 0,
    matchedCount: 0,
    mergedCount: 0,
    refreshedCount: 0,
    unmatchedCount: 0,
    tmdbConfigured: true,
    errorCode: null,
    errorMessage: null,
    unmatchedTitles: [],
  };

  if (uniqueIds.length === 0) return summary;

  const CHUNK_SIZE = 20;
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    const { data, error, response } = await client.functions.invoke<ReenrichSummary>('tmdb-proxy', {
      body: {
        action: 'reenrich_unmatched',
        movieIds: chunk,
        language: 'ru-RU',
      },
    });

    if (error || !data) {
      const chunkStart = i + 1;
      const chunkEnd = Math.min(i + chunk.length, uniqueIds.length);
      const detail = error
        ? await extractEdgeFunctionErrorMessage(
            error,
            'Ошибка дообогащения метаданных через TMDB.',
            response
          )
        : 'Ошибка дообогащения метаданных через TMDB.';
      throw new Error(`Ошибка на этапе ${chunkStart}–${chunkEnd} из ${uniqueIds.length}: ${detail}`);
    }

    summary.totalProcessed += data.totalProcessed ?? 0;
    summary.matchedCount += data.matchedCount ?? 0;
    summary.mergedCount += data.mergedCount ?? 0;
    summary.refreshedCount += data.refreshedCount ?? 0;
    summary.unmatchedCount += data.unmatchedCount ?? 0;
    if (Array.isArray(data.unmatchedTitles) && data.unmatchedTitles.length > 0) {
      summary.unmatchedTitles.push(...data.unmatchedTitles);
    }

    if (!data.tmdbConfigured) {
      summary.tmdbConfigured = false;
    }
    if (data.errorCode) {
      summary.errorCode = data.errorCode;
      summary.errorMessage = data.errorMessage;
    }

    onProgress?.(Math.min(i + chunk.length, uniqueIds.length), uniqueIds.length);

    if (!data.tmdbConfigured || data.errorCode === 'TMDB_AUTH_ERROR') {
      break;
    }
  }

  return summary;
}
