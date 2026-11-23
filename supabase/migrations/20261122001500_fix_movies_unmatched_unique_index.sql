-- =============================================================================
-- Cinelog — Fix per-user uniqueness for unmatched fallback movies
--   1. Remove unreferenced legacy orphan fallback rows (tmdb_id IS NULL,
--      created_by IS NULL) left over from before Phase 3 multi-tenant isolation.
--   2. Drop legacy global unique index `movies_unmatched_title_year_key`
--      (which blocked different users from importing the same unmatched movie).
--   3. Replace non-unique `movies_unmatched_owner_title_year_idx` with a
--      per-user partial UNIQUE index `movies_unmatched_owner_title_year_key`
--      on (created_by, lower(title), coalesce(release_year, 0))
--      WHERE tmdb_id IS NULL AND created_by IS NOT NULL.
-- =============================================================================

-- 1. Clean up unreferenced legacy orphan unmatched rows
delete from public.movies m
where m.tmdb_id is null
  and m.created_by is null
  and not exists (
    select 1
    from public.watch_logs w
    where w.movie_id = m.id
  );

-- 2. Replace legacy global unique index & non-unique owner index with per-user unique index
drop index if exists public.movies_unmatched_title_year_key;
drop index if exists public.movies_unmatched_owner_title_year_idx;

create unique index if not exists movies_unmatched_owner_title_year_key
  on public.movies (created_by, lower(title), coalesce(release_year, 0))
  where tmdb_id is null and created_by is not null;

analyze public.movies;
