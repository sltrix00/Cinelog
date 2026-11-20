-- =============================================================================
-- Cinelog — initial schema
-- Tables: profiles, movies (shared TMDB cache), watch_logs (per-user diary)
-- View:   watch_entries (watch_logs ⨝ movies, security_invoker → RLS-aware)
--
-- Security model
--   • RLS is enabled on EVERY table in the exposed `public` schema.
--   • Since 2026 Supabase no longer auto-grants new tables to the Data API
--     roles, so every privilege below is granted EXPLICITLY.
--   • profiles / watch_logs: strict ownership — (select auth.uid()) = user_id.
--   • movies: read-only for signed-in users; written only by the
--     `tmdb-proxy` Edge Function using the service role (bypasses RLS).
--   • Privileged helpers (SECURITY DEFINER) live in the non-exposed `private`
--     schema with an empty search_path and EXECUTE revoked from PUBLIC.
--
-- Extension-ready: watch_logs.user_id defaults to auth.uid(), so a Manifest V3
-- extension signed in through supabase-js can simply
--   insert { movie_id, watched_date, watched_time, source: 'extension',
--            import_key: 'ext:<event-uuid>' }
-- and RLS + the unique (user_id, import_key) key make retries idempotent.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.watch_source as enum (
  'manual',          -- "+ Add Watch" modal
  'csv_letterboxd',  -- Letterboxd diary.csv / watched.csv / ratings.csv
  'csv_imdb',        -- IMDb ratings export
  'extension',       -- Manifest V3 browser extension (exact timestamps)
  'txt_diary'        -- legacy Cinelog plain-text diary ("Просмотренные фильмы 2024")
);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Generic updated_at maintenance (SECURITY INVOKER — it only touches NEW).
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

-- IANA timezone validation, e.g. 'Asia/Yekaterinburg'.
create or replace function private.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if tz is null or length(tz) > 64 then
    return false;
  end if;
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function private.is_valid_timezone(text) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_valid_timezone(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text check (username ~ '^[A-Za-z0-9_.-]{3,32}$'),
  timezone    text not null default 'UTC'
              check (private.is_valid_timezone(timezone)),
  preferences jsonb not null default '{}'::jsonb
              check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 32768),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Per-user settings. timezone drives "today", week and month boundaries in analytics.';

create unique index profiles_username_lower_key on public.profiles (lower(username));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Auto-create a profile for every new auth user (email/password or Google).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  v_timezone text := nullif(trim(new.raw_user_meta_data ->> 'timezone'), '');
begin
  -- user_metadata is user-controlled: only use it as a *suggestion*, validated.
  if v_username is not null and (
       v_username !~ '^[A-Za-z0-9_.-]{3,32}$'
       or exists (select 1 from public.profiles p where lower(p.username) = lower(v_username))
     ) then
    v_username := null;
  end if;

  if not private.is_valid_timezone(v_timezone) then
    v_timezone := 'UTC';
  end if;

  begin
    insert into public.profiles (id, username, timezone)
    values (new.id, v_username, v_timezone)
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username, timezone)
    values (new.id, null, v_timezone)
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No INSERT/DELETE policies: rows are created by the trigger and removed by
-- the auth.users cascade. Column-level grant keeps id/created_at immutable.
revoke all on table public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, timezone, preferences) on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- -----------------------------------------------------------------------------
-- movies — shared metadata cache filled by the tmdb-proxy Edge Function
-- -----------------------------------------------------------------------------
create table public.movies (
  id              uuid primary key default gen_random_uuid(),
  tmdb_id         integer unique check (tmdb_id > 0),   -- NULL = unmatched import fallback
  imdb_id         text check (imdb_id ~ '^tt[0-9]{5,10}$'),
  title           text not null check (char_length(title) between 1 and 500),
  original_title  text check (char_length(original_title) <= 500),
  release_year    smallint check (release_year between 1870 and 2100),
  runtime_minutes smallint check (runtime_minutes between 1 and 1500),
  genres          text[] not null default '{}',
  directors       text[] not null default '{}',
  countries       text[] not null default '{}',
  poster_url      text check (poster_url ~ '^https://image\.tmdb\.org/t/p/'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.movies is 'Shared TMDB metadata cache. Written only by the tmdb-proxy Edge Function (service role).';
comment on column public.movies.tmdb_id is 'TMDB id. NULL only for import rows that TMDB could not match (title/year fallback).';

create index movies_imdb_id_idx on public.movies (imdb_id) where imdb_id is not null;
-- One fallback row per (title, year) so repeated unmatched imports reuse it.
create unique index movies_unmatched_title_year_key
  on public.movies (lower(title), coalesce(release_year, 0))
  where tmdb_id is null;

create trigger movies_set_updated_at
  before update on public.movies
  for each row execute function private.set_updated_at();

alter table public.movies enable row level security;
alter table public.movies force row level security;

create policy "movies: readable by signed-in users"
  on public.movies for select
  to authenticated
  using (
    tmdb_id is not null
    or exists (
      select 1 from public.watch_logs w
      where w.movie_id = public.movies.id
        and w.user_id = (select auth.uid())
    )
  );

-- Intentionally NO insert/update/delete policies for clients.
revoke all on table public.movies from public, anon, authenticated;
grant select on public.movies to authenticated;
grant all on public.movies to service_role;

-- -----------------------------------------------------------------------------
-- watch_logs — individual viewing records
-- -----------------------------------------------------------------------------
create table public.watch_logs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid()
                           references auth.users (id) on delete cascade,
  movie_id                 uuid not null references public.movies (id) on delete restrict,
  watched_date             date not null
                           check (watched_date between date '1888-01-01' and date '2100-12-31'),
  watched_time             time,   -- present for manual / extension logs, NULL for CSV imports
  rating                   numeric(2, 1)
                           check (rating between 0.5 and 5.0 and rating * 2 = trunc(rating * 2)),
  is_rewatch               boolean not null default false,
  source                   public.watch_source not null default 'manual',
  runtime_override_minutes smallint check (runtime_override_minutes between 1 and 1500),
  import_key               text check (char_length(import_key) between 1 and 300),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Idempotent batch upserts (CSV re-imports, extension retries).
  -- NULLs are distinct, so manual logs never collide.
  constraint watch_logs_user_import_key_key unique (user_id, import_key)
);

comment on column public.watch_logs.rating is '0.5–5.0 in half steps (Letterboxd scale). IMDb 1–10 ratings are halved on import.';
comment on column public.watch_logs.import_key is 'Stable per-row key: "<source>:<ref>:<date>:<n>" for CSV, "ext:<uuid>" for the extension.';

-- Dashboard query: all of a user's logs ordered by date.
create index watch_logs_user_date_idx on public.watch_logs (user_id, watched_date desc, watched_time desc nulls last);
-- FK index + rewatch detection ("have I seen this movie before?").
create index watch_logs_user_movie_idx on public.watch_logs (user_id, movie_id);
create index watch_logs_movie_id_idx on public.watch_logs (movie_id);

create trigger watch_logs_set_updated_at
  before update on public.watch_logs
  for each row execute function private.set_updated_at();

alter table public.watch_logs enable row level security;
alter table public.watch_logs force row level security;

create policy "watch_logs: owner can select"
  on public.watch_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "watch_logs: owner can insert"
  on public.watch_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "watch_logs: owner can update"
  on public.watch_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "watch_logs: owner can delete"
  on public.watch_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.watch_logs from public, anon, authenticated;
grant select, delete on public.watch_logs to authenticated;
grant insert (
  user_id,
  movie_id,
  watched_date,
  watched_time,
  rating,
  is_rewatch,
  source,
  runtime_override_minutes,
  import_key
) on table public.watch_logs to authenticated;
grant update (
  movie_id,
  watched_date,
  watched_time,
  rating,
  is_rewatch,
  source,
  runtime_override_minutes,
  import_key
) on table public.watch_logs to authenticated;
grant all on public.watch_logs to service_role;

-- -----------------------------------------------------------------------------
-- watch_entries — denormalised read model for the dashboard
-- security_invoker = true → the caller's RLS on watch_logs/movies applies.
-- -----------------------------------------------------------------------------
create view public.watch_entries
with (security_invoker = true) as
select
  w.id,
  w.user_id,
  w.movie_id,
  w.watched_date,
  w.watched_time,
  w.rating,
  w.is_rewatch,
  w.source,
  w.import_key,
  w.runtime_override_minutes,
  w.created_at,
  m.tmdb_id,
  m.imdb_id,
  m.title,
  m.original_title,
  m.release_year,
  coalesce(w.runtime_override_minutes, m.runtime_minutes) as runtime_minutes,
  m.genres,
  m.directors,
  m.countries,
  m.poster_url
from public.watch_logs w
join public.movies m on m.id = w.movie_id;

revoke all on table public.watch_entries from public, anon, authenticated;
grant select on public.watch_entries to authenticated;
grant select on public.watch_entries to service_role;

-- anon gets nothing: Demo Mode runs entirely client-side.
revoke all on public.profiles, public.movies, public.watch_logs, public.watch_entries from public, anon;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
