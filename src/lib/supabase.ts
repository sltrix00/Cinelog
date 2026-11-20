import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import type {
  MovieRecord,
  ParsedImportRow,
  ProfileRecord,
  TmdbSearchResult,
  WatchEntry,
  WatchSource,
} from '../types/cinelog';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('YOUR-PROJECT-REF') &&
    !supabaseKey.includes('xxxxxxxx')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
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

export function onAuthChanged(callback: (user: User | null) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
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
      data: {
        username: username?.trim() || undefined,
        timezone,
      },
    },
  });
}

export async function signInWithGoogle() {
  const client = requireClient();
  return client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
}

export async function signOutAccount() {
  if (!supabase) return;
  await supabase.auth.signOut();
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
  id: string;
  movie_id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  release_year: number | null;
  watched_date: string;
  watched_time: string | null;
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
  const rating =
    row.rating === null || row.rating === undefined ? null : Number.parseFloat(String(row.rating));
  return {
    id: row.id,
    movie_id: row.movie_id,
    tmdb_id: row.tmdb_id,
    imdb_id: row.imdb_id,
    title: row.title,
    original_title: row.original_title,
    release_year: row.release_year,
    watched_date: row.watched_date,
    watched_time: row.watched_time,
    rating: rating !== null && Number.isNaN(rating) ? null : rating,
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

export async function fetchWatchEntries(): Promise<WatchEntry[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('watch_entries')
    .select('*')
    .order('watched_date', { ascending: false })
    .order('watched_time', { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Не удалось загрузить просмотры: ${error.message}`);
  }
  return (data as WatchEntryRow[]).map(mapRowToWatchEntry);
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
  const { data: resolved, error: resolveError } = await client.functions.invoke<{
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
    throw new Error(resolveError?.message ?? 'Не удалось сохранить метаданные фильма через Edge Function.');
  }

  const movie = resolved.movies[0];
  const runtimeOverride =
    input.runtimeMinutes && input.runtimeMinutes !== movie.runtime_minutes ? input.runtimeMinutes : null;

  const { data: inserted, error: insertError } = await client
    .from('watch_logs')
    .insert({
      movie_id: movie.id,
      watched_date: input.watchedDate,
      watched_time: input.watchedTime,
      rating: input.rating,
      is_rewatch: input.isRewatch,
      source: 'manual',
      runtime_override_minutes: runtimeOverride,
    })
    .select('id')
    .single<{ id: string }>();

  if (insertError || !inserted) {
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

export async function deleteWatchLogById(logId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('watch_logs').delete().eq('id', logId);
  if (error) {
    throw new Error(`Не удалось удалить запись: ${error.message}`);
  }
}

export async function batchUpsertImportedRows(
  rows: ParsedImportRow[],
  onProgress?: (processed: number, total: number) => void
): Promise<{ importedCount: number; moviesResolved: number }> {
  const client = requireClient();
  const nonDuplicates = rows.filter((r) => !r.isDuplicate);
  if (!nonDuplicates.length) return { importedCount: 0, moviesResolved: 0 };

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

  // Resolve movies in chunks of 40 via tmdb-proxy Edge Function
  const CHUNK_SIZE = 40;
  for (let i = 0; i < descriptorItems.length; i += CHUNK_SIZE) {
    const chunkItems = descriptorItems.slice(i, i + CHUNK_SIZE);
    const chunkKeys = descriptorKeys.slice(i, i + CHUNK_SIZE);
    const { data, error } = await client.functions.invoke<{ movies: MovieRecord[] }>('tmdb-proxy', {
      body: {
        action: 'resolve_batch',
        items: chunkItems,
        language: 'ru-RU',
      },
    });
    if (error || !data?.movies) {
      throw new Error(error?.message ?? 'Ошибка обогащения метаданных при импорте CSV.');
    }
    data.movies.forEach((movie, idx) => {
      resolvedMovieByKey.set(chunkKeys[idx], movie);
    });
    onProgress?.(Math.min(i + chunkItems.length, descriptorItems.length), descriptorItems.length);
  }

  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
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
      user_id: userId,
      movie_id: movie.id,
      watched_date: r.watchedDate,
      watched_time: r.watchedTime,
      rating: r.rating,
      is_rewatch: r.isRewatch,
      source: r.source,
      runtime_override_minutes: runtimeOverride,
      import_key: r.importKey,
    };
  });

  // Batch upsert to watch_logs in chunks of 200 (idempotent on user_id + import_key)
  const UPSERT_CHUNK = 200;
  for (let i = 0; i < payload.length; i += UPSERT_CHUNK) {
    const slice = payload.slice(i, i + UPSERT_CHUNK);
    const { error } = await client
      .from('watch_logs')
      .upsert(slice, { onConflict: 'user_id,import_key' });
    if (error) {
      throw new Error(`Ошибка пакетного сохранения в Supabase: ${error.message}`);
    }
  }

  return {
    importedCount: payload.length,
    moviesResolved: resolvedMovieByKey.size,
  };
}
