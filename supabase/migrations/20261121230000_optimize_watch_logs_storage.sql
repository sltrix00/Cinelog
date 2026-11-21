-- =============================================================================
-- Cinelog — Optimize public.watch_logs Storage (~2x smaller per user)
--   1. Compress `import_key` (text ~42B) -> `import_key_hash` (bigint, 8B)
--      using deterministic 64-bit SHA-256 prefix hash in private.hash_import_key().
--   2. Replace `id uuid` (random v4, 16B) -> `bigint generated always as identity`
--      (sequential, 8B) to eliminate B-tree PK fragmentation.
--   3. Drop redundant `watch_logs_user_movie_idx` and make
--      `watch_logs_user_import_key_idx` partial (WHERE import_key_hash IS NOT NULL),
--      backed by SECURITY INVOKER RPC `public.upsert_watch_logs(jsonb)`.
--   4. Pack heavy columns & align layout:
--      - `rating numeric(2,1)` -> `rating_x2 smallint` (1..10)
--      - `watched_time time` -> `watched_time_min smallint` (0..1439)
--      - Drop unused `updated_at` & `watch_logs_set_updated_at` trigger
--      - Expose reconstructed `watched_time` & `rating` in `public.watch_entries`.
--   5. Lower per-user quota from 50,000 -> 10,000 entries (upsert-safe at limit).
-- =============================================================================

-- 1. Deterministic 64-bit hash helper for idempotent import_key deduplication
create or replace function private.hash_import_key(p_key text)
returns bigint
language sql
immutable
strict
set search_path = ''
as $$
  select (
    'x' || pg_catalog.encode(
      pg_catalog.substr(
        pg_catalog.sha256(pg_catalog.convert_to(p_key, 'UTF8')),
        1,
        8
      ),
      'hex'
    )
  )::bit(64)::bigint;
$$;

revoke all on function private.hash_import_key(text) from public, anon;
grant execute on function private.hash_import_key(text) to authenticated, service_role;

-- 2. Stage transformed existing rows in a session-local TEMP table (outside `public`)
drop table if exists pg_temp.watch_logs_backup;

create temp table watch_logs_backup as
select
  row_number() over (order by w.created_at asc, w.watched_date asc, w.id asc) as seq_ord,
  case
    when w.import_key is not null then private.hash_import_key(w.import_key)
    else null
  end as import_key_hash,
  w.created_at,
  w.user_id,
  w.movie_id,
  w.watched_date,
  w.source,
  case
    when w.watched_time is not null then
      (extract(hour from w.watched_time)::int * 60 + extract(minute from w.watched_time)::int)::smallint
    else null
  end as watched_time_min,
  case
    when w.rating is not null then round(w.rating * 2)::smallint
    else null
  end as rating_x2,
  w.runtime_override_minutes,
  w.is_rewatch
from public.watch_logs w;

-- 3. Assert staging parity before dropping legacy table
do $$
declare
  v_old bigint;
  v_bak bigint;
begin
  select count(*) into v_old from public.watch_logs;
  select count(*) into v_bak from watch_logs_backup;
  if v_old <> v_bak then
    raise exception 'watch_logs staging row count mismatch: old=%, backup=%', v_old, v_bak;
  end if;
end $$;

-- 4. Drop legacy view & table and recreate compact `public.watch_logs` directly
drop view public.watch_entries;
drop table public.watch_logs;

create table public.watch_logs (
  id                       bigint generated always as identity primary key,
  import_key_hash          bigint,
  created_at               timestamptz not null default now(),
  user_id                  uuid not null default auth.uid()
                           references auth.users (id) on delete cascade,
  movie_id                 uuid not null
                           references public.movies (id) on delete restrict,
  watched_date             date not null
                           check (watched_date between date '1888-01-01' and date '2100-12-31'),
  source                   public.watch_source not null default 'manual',
  watched_time_min         smallint
                           check (watched_time_min between 0 and 1439),
  rating_x2                smallint
                           check (rating_x2 between 1 and 10),
  runtime_override_minutes smallint
                           check (runtime_override_minutes between 1 and 1500),
  is_rewatch               boolean not null default false
);

-- 5. Restore all staged rows chronologically and verify exact parity
insert into public.watch_logs (
  import_key_hash,
  created_at,
  user_id,
  movie_id,
  watched_date,
  source,
  watched_time_min,
  rating_x2,
  runtime_override_minutes,
  is_rewatch
)
select
  import_key_hash,
  created_at,
  user_id,
  movie_id,
  watched_date,
  source,
  watched_time_min,
  rating_x2,
  runtime_override_minutes,
  is_rewatch
from watch_logs_backup
order by seq_ord asc;

do $$
declare
  v_bak bigint;
  v_new bigint;
begin
  select count(*) into v_bak from watch_logs_backup;
  select count(*) into v_new from public.watch_logs;
  if v_bak <> v_new then
    raise exception 'watch_logs restore row count mismatch: backup=%, new=%', v_bak, v_new;
  end if;
end $$;

drop table watch_logs_backup;

comment on column public.watch_logs.watched_time_min is 'Minutes since midnight (0..1439) for manual/extension logs; NULL for CSV imports.';
comment on column public.watch_logs.rating_x2 is 'Rating doubled (1..10 representing 0.5..5.0 in half-star steps).';
comment on column public.watch_logs.import_key_hash is '64-bit SHA-256 hash of deterministic import_key for idempotent CSV/extension upserts.';

-- 6. Lean index set (4 indexes total: PK + 3 secondary; redundant user_movie index dropped)
create index watch_logs_user_date_idx
  on public.watch_logs (user_id, watched_date desc, watched_time_min desc nulls last);

create index watch_logs_movie_id_idx
  on public.watch_logs (movie_id);

create unique index watch_logs_user_import_key_idx
  on public.watch_logs (user_id, import_key_hash)
  where import_key_hash is not null;

-- 7. Per-user storage quota on public.watch_logs (10,000 rows/user, upsert-friendly)
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

  if v_count >= 10000 then
    if new.import_key_hash is not null and exists (
      select 1
      from public.watch_logs
      where user_id = new.user_id
        and import_key_hash = new.import_key_hash
    ) then
      return new;
    end if;

    raise exception 'Watch log quota exceeded (maximum 10,000 entries per user)'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_watch_logs_quota() from public, anon, authenticated;

create trigger watch_logs_enforce_quota
  before insert on public.watch_logs
  for each row execute function private.enforce_watch_logs_quota();

-- 8. RLS, hardened policies, and strict column-level least-privilege grants
alter table public.watch_logs enable row level security;
alter table public.watch_logs force row level security;

create policy "watch_logs: owner can select"
  on public.watch_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "watch_logs: owner can insert"
  on public.watch_logs for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.movies m
      where m.id = movie_id
    )
  );

create policy "watch_logs: owner can update"
  on public.watch_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.movies m
      where m.id = movie_id
    )
  );

create policy "watch_logs: owner can delete"
  on public.watch_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.watch_logs from public, anon, authenticated;
grant select, delete on table public.watch_logs to authenticated;
grant insert (
  user_id,
  movie_id,
  watched_date,
  watched_time_min,
  rating_x2,
  is_rewatch,
  source,
  runtime_override_minutes,
  import_key_hash
) on table public.watch_logs to authenticated;
grant update (
  movie_id,
  watched_date,
  watched_time_min,
  rating_x2,
  is_rewatch,
  source,
  runtime_override_minutes,
  import_key_hash
) on table public.watch_logs to authenticated;
grant all on table public.watch_logs to service_role;

-- 9. Recreate denormalised read view with security_invoker = true (zero disk overhead)
create view public.watch_entries
with (security_invoker = true) as
select
  w.id,
  w.user_id,
  w.movie_id,
  w.watched_date,
  w.watched_time_min,
  case
    when w.watched_time_min is not null then
      pg_catalog.make_time((w.watched_time_min / 60)::int, (w.watched_time_min % 60)::int, 0::double precision)
  end as watched_time,
  w.rating_x2,
  case
    when w.rating_x2 is not null then
      (w.rating_x2::numeric / 2.0)::numeric(2, 1)
  end as rating,
  w.is_rewatch,
  w.source,
  w.import_key_hash::text as import_key,
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
grant select on table public.watch_entries to authenticated, service_role;

-- 10. SECURITY INVOKER batch upsert RPC supporting partial unique index on (user_id, import_key_hash)
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

analyze public.watch_logs;
