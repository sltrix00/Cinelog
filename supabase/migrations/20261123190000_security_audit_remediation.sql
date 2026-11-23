-- =============================================================================
-- Cinelog — Security Audit Remediation
--   1. Drop redundant `movies_poster_url_check` superseded by
--      `movies_poster_url_tmdb_host_check`.
--   2. Clean up any stray ownership mismatch, validate
--      `movies_unmatched_requires_owner_check`, switch `movies_created_by_fkey`
--      from ON DELETE SET NULL to ON DELETE CASCADE, and add
--      `private.handle_delete_user()` BEFORE DELETE trigger on `auth.users`
--      so user deletion never collides with CHECK or FK constraints.
--   3. Replace per-row quota triggers on `public.watch_logs` and
--      `public.movies` with statement-level AFTER INSERT triggers using
--      transition tables (`REFERENCING NEW TABLE AS new_rows`) and
--      transaction-scoped advisory locks (`pg_advisory_xact_lock`) to
--      prevent TOCTOU quota bypasses and quadratic COUNT(*) scans.
--   4. Acquire the user's `watch_logs_quota` advisory lock inside
--      `public.upsert_watch_logs(jsonb)` before inserting/upserting.
-- =============================================================================

-- 1. Clean up redundant constraint
alter table public.movies drop constraint if exists movies_poster_url_check;

-- 2. Data cleanliness + validate NOT VALID check constraint + cascade user deletion
update public.movies
set created_by = null
where tmdb_id is not null
  and created_by is not null;

delete from public.movies m
where m.tmdb_id is null
  and m.created_by is null
  and not exists (
    select 1 from public.watch_logs w where w.movie_id = m.id
  );

alter table public.movies validate constraint movies_unmatched_requires_owner_check;

alter table public.movies
  drop constraint if exists movies_created_by_fkey,
  add constraint movies_created_by_fkey
    foreign key (created_by) references auth.users (id) on delete cascade;

create or replace function private.handle_delete_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.watch_logs where user_id = old.id;
  delete from public.movies where tmdb_id is null and created_by = old.id;
  return old;
end;
$$;

revoke all on function private.handle_delete_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function private.handle_delete_user();

-- 3. Statement-level, advisory-locked quota enforcement on public.watch_logs
drop trigger if exists watch_logs_enforce_quota on public.watch_logs;

create or replace function private.enforce_watch_logs_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid;
  v_count bigint;
begin
  for v_uid in
    select distinct nr.user_id
    from new_rows nr
    where nr.user_id is not null
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('watch_logs_quota:' || v_uid::text, 0)
    );

    select count(*) into v_count
    from public.watch_logs w
    where w.user_id = v_uid;

    if v_count > 10000 then
      raise exception 'Watch log quota exceeded (maximum 10,000 entries per user)'
        using errcode = '54000';
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function private.enforce_watch_logs_quota() from public, anon, authenticated;

create trigger watch_logs_enforce_quota
  after insert on public.watch_logs
  referencing new table as new_rows
  for each statement execute function private.enforce_watch_logs_quota();

-- 4. Statement-level, advisory-locked quota enforcement on unmatched public.movies
drop trigger if exists movies_enforce_unmatched_quota on public.movies;

create or replace function private.enforce_unmatched_movies_quota()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid;
  v_count bigint;
begin
  for v_uid in
    select distinct nr.created_by
    from new_rows nr
    where nr.tmdb_id is null
      and nr.created_by is not null
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('unmatched_movies_quota:' || v_uid::text, 0)
    );

    select count(*) into v_count
    from public.movies m
    where m.tmdb_id is null
      and m.created_by = v_uid;

    if v_count > 5000 then
      raise exception 'Unmatched movies quota exceeded (maximum 5,000 unmatched entries per user)'
        using errcode = '54000';
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function private.enforce_unmatched_movies_quota() from public, anon, authenticated;

create trigger movies_enforce_unmatched_quota
  after insert on public.movies
  referencing new table as new_rows
  for each statement execute function private.enforce_unmatched_movies_quota();

-- 5. Serialize concurrent batch upserts per user before inserting rows
create or replace function public.upsert_watch_logs(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_len      integer;
  v_affected integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = '22023';
  end if;

  v_len := pg_catalog.jsonb_array_length(p_rows);
  if v_len = 0 then
    return 0;
  end if;
  if v_len > 250 then
    raise exception 'Batch too large (max 250 rows per call)' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_rows) as elem
    where pg_catalog.jsonb_typeof(elem) <> 'object'
       or nullif(pg_catalog.btrim(elem ->> 'import_key'), '') is null
       or char_length(elem ->> 'import_key') > 300
  ) then
    raise exception 'Each row must be an object with a non-empty import_key (1..300 chars)'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('watch_logs_quota:' || v_uid::text, 0)
  );

  with parsed as (
    select
      elem.ord,
      (elem.val ->> 'movie_id')::uuid as movie_id,
      (elem.val ->> 'watched_date')::date as watched_date,
      nullif(pg_catalog.btrim(elem.val ->> 'watched_time_min'), '')::smallint as watched_time_min,
      nullif(pg_catalog.btrim(elem.val ->> 'rating_x2'), '')::smallint as rating_x2,
      coalesce(nullif(pg_catalog.btrim(elem.val ->> 'is_rewatch'), '')::boolean, false) as is_rewatch,
      coalesce(
        nullif(pg_catalog.btrim(elem.val ->> 'source'), '')::public.watch_source,
        'csv_letterboxd'::public.watch_source
      ) as source,
      nullif(pg_catalog.btrim(elem.val ->> 'runtime_override_minutes'), '')::smallint as runtime_override_minutes,
      private.hash_import_key(elem.val ->> 'import_key') as import_key_hash
    from pg_catalog.jsonb_array_elements(p_rows) with ordinality as elem(val, ord)
  ),
  deduped as (
    select distinct on (import_key_hash)
      movie_id,
      watched_date,
      watched_time_min,
      rating_x2,
      is_rewatch,
      source,
      runtime_override_minutes,
      import_key_hash
    from parsed
    order by import_key_hash, ord desc
  )
  insert into public.watch_logs (
    user_id,
    movie_id,
    watched_date,
    watched_time_min,
    rating_x2,
    is_rewatch,
    source,
    runtime_override_minutes,
    import_key_hash
  )
  select
    v_uid,
    movie_id,
    watched_date,
    watched_time_min,
    rating_x2,
    is_rewatch,
    source,
    runtime_override_minutes,
    import_key_hash
  from deduped
  on conflict (user_id, import_key_hash) where import_key_hash is not null
  do update set
    movie_id                 = excluded.movie_id,
    watched_date             = excluded.watched_date,
    watched_time_min         = excluded.watched_time_min,
    rating_x2                = excluded.rating_x2,
    is_rewatch               = excluded.is_rewatch,
    source                   = excluded.source,
    runtime_override_minutes = excluded.runtime_override_minutes;

  get diagnostics v_affected = row_count;
  return v_affected;
end;
$$;

revoke all on function public.upsert_watch_logs(jsonb) from public, anon;
grant execute on function public.upsert_watch_logs(jsonb) to authenticated, service_role;
