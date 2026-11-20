-- =============================================================================
-- Cinelog — Security Hardening Phase 3 (Multi-Tenant Isolation & Storage Quota)
--   1. Backfill `created_by` on existing referenced unmatched fallback rows
--      (tmdb_id IS NULL) from public.watch_logs.
--   2. Add covering index `movies_created_by_idx` for `movies_created_by_fkey`
--      and per-user lookup index `movies_unmatched_owner_title_year_idx`.
--   3. Enforce `CHECK (tmdb_id IS NOT NULL OR created_by IS NOT NULL) NOT VALID`
--      so all future unmatched rows require an explicit owner.
--   4. Tighten `public.movies` SELECT RLS policy to strict ownership for
--      unmatched rows (`tmdb_id IS NOT NULL OR created_by = (select auth.uid())`).
--   5. Tighten `public.watch_logs` INSERT and UPDATE RLS policies so a user can
--      only link `movie_id` to a public TMDB movie or their own unmatched row.
--   6. Add per-user unmatched fallback movie quota trigger (max 5,000 rows/user)
--      to prevent unbounded DB growth via `tmdb-proxy` `resolve_batch`.
-- =============================================================================

-- 1. Backfill owner on existing referenced unmatched fallback rows
update public.movies m
set created_by = (
  select w.user_id
  from public.watch_logs w
  where w.movie_id = m.id
  order by w.created_at asc
  limit 1
)
where m.tmdb_id is null
  and m.created_by is null
  and exists (
    select 1 from public.watch_logs w where w.movie_id = m.id
  );

-- 2. Covering index for movies.created_by FK & fast per-user fallback lookups
create index if not exists movies_created_by_idx
  on public.movies (created_by)
  where created_by is not null;

create index if not exists movies_unmatched_owner_title_year_idx
  on public.movies (created_by, lower(title), coalesce(release_year, 0))
  where tmdb_id is null and created_by is not null;

-- 3. Require owner on all future unmatched fallback rows (NOT VALID keeps legacy unused orphan rows untouched)
alter table public.movies
  add constraint movies_unmatched_requires_owner_check
  check (tmdb_id is not null or created_by is not null) not valid;

-- 4. Strict owner-only RLS for unmatched fallback movies
alter policy "movies: readable by signed-in users"
  on public.movies
  to authenticated
  using (
    tmdb_id is not null
    or created_by = (select auth.uid())
  );

-- 5. Prevent linking watch_logs to another user's private unmatched movie
alter policy "watch_logs: owner can insert"
  on public.watch_logs
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.movies m
      where m.id = movie_id
    )
  );

alter policy "watch_logs: owner can update"
  on public.watch_logs
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.movies m
      where m.id = movie_id
    )
  );

-- 6. Per-user storage quota on unmatched fallback rows in public.movies (max 5,000/user)
create or replace function private.enforce_unmatched_movies_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if new.tmdb_id is null and new.created_by is not null then
    select count(*) into v_count
    from public.movies
    where tmdb_id is null
      and created_by = new.created_by;

    if v_count >= 5000 then
      raise exception 'Unmatched movies quota exceeded (maximum 5,000 unmatched entries per user)'
        using errcode = '54000';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_unmatched_movies_quota() from public, anon, authenticated;

create or replace trigger movies_enforce_unmatched_quota
  before insert on public.movies
  for each row execute function private.enforce_unmatched_movies_quota();
