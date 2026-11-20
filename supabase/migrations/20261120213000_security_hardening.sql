-- =============================================================================
-- Cinelog — Security Hardening Migration
--   1. Revoke excessive default table privileges (TRUNCATE, TRIGGER, REFERENCES,
--      MAINTAIN) from PUBLIC, anon, and authenticated; re-grant strict minimum.
--   2. Enforce column-level INSERT/UPDATE grants on watch_logs (prevent forging
--      id, created_at, updated_at).
--   3. Enable FORCE ROW LEVEL SECURITY on all tables in public.
--   4. Restrict public.movies SELECT policy so unmatched fallback rows
--      (tmdb_id IS NULL) are only visible to users who have them in watch_logs.
--   5. Bound profiles.preferences JSONB payload size (<= 32 KB) and restrict
--      movies.poster_url to image.tmdb.org.
--   6. Harden private schema helper function privileges and make
--      private.handle_new_user() resilient to concurrent duplicate usernames.
-- =============================================================================

-- 1. Future default privileges in public schema: do not auto-grant to anon/authenticated
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- 2. Strip all existing privileges (including TRUNCATE, TRIGGER, REFERENCES, MAINTAIN)
revoke all on table public.profiles, public.movies, public.watch_logs, public.watch_entries
  from public, anon, authenticated;

-- 3. Re-grant strict least-privilege permissions to authenticated & service_role
grant select on table public.profiles to authenticated;
grant update (username, timezone, preferences) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

grant select on table public.movies to authenticated;
grant all on table public.movies to service_role;

grant select, delete on table public.watch_logs to authenticated;
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
grant all on table public.watch_logs to service_role;

grant select on table public.watch_entries to authenticated, service_role;

-- 4. Force RLS on all public tables
alter table public.profiles force row level security;
alter table public.movies force row level security;
alter table public.watch_logs force row level security;

-- 5. Cross-tenant privacy for unmatched fallback rows in public.movies
alter policy "movies: readable by signed-in users"
  on public.movies
  to authenticated
  using (
    tmdb_id is not null
    or exists (
      select 1 from public.watch_logs w
      where w.movie_id = public.movies.id
        and w.user_id = (select auth.uid())
    )
  );

-- 6. Bound profiles.preferences size and restrict movies.poster_url host
alter table public.profiles
  add constraint profiles_preferences_max_size_check
  check (octet_length(preferences::text) <= 32768);

alter table public.movies
  add constraint movies_poster_url_tmdb_host_check
  check (poster_url ~ '^https://image\.tmdb\.org/t/p/');

-- 7. Harden private helper functions & TOCTOU-safe handle_new_user()
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.is_valid_timezone(text) from public, anon;
grant execute on function private.is_valid_timezone(text) to authenticated, service_role;

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
