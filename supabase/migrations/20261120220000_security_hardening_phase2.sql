-- =============================================================================
-- Cinelog — Security Hardening Phase 2
--   1. Audit attribution column `created_by` on public.movies (unmatched rows),
--      hidden from `authenticated` via column-level SELECT grants.
--   2. Array length CHECK constraints on public.movies (genres/directors/countries).
--   3. Per-user row quota trigger on public.watch_logs (max 50,000 rows/user).
-- =============================================================================

-- 1. Audit attribution for fallback rows in public.movies
alter table public.movies
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- Replace table-wide SELECT with column-level SELECT so `created_by` is not exposed to other users
revoke select on table public.movies from authenticated;
grant select (
  id,
  tmdb_id,
  imdb_id,
  title,
  original_title,
  release_year,
  runtime_minutes,
  genres,
  directors,
  countries,
  poster_url,
  created_at,
  updated_at
) on table public.movies to authenticated;

-- 2. Bound array sizes on public.movies
alter table public.movies
  add constraint movies_genres_max_len_check
  check (coalesce(array_length(genres, 1), 0) <= 10);

alter table public.movies
  add constraint movies_directors_max_len_check
  check (coalesce(array_length(directors, 1), 0) <= 10);

alter table public.movies
  add constraint movies_countries_max_len_check
  check (coalesce(array_length(countries, 1), 0) <= 10);

-- 3. Per-user storage quota on public.watch_logs (50,000 rows/user)
create or replace function private.enforce_watch_logs_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.watch_logs
  where user_id = new.user_id;

  if v_count >= 50000 then
    raise exception 'Watch log quota exceeded (maximum 50,000 entries per user)'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_watch_logs_quota() from public, anon, authenticated;

create or replace trigger watch_logs_enforce_quota
  before insert on public.watch_logs
  for each row execute function private.enforce_watch_logs_quota();
