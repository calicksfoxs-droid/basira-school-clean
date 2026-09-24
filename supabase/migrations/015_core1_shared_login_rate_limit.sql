-- CORE 1.0 shared login throttling.
-- Production uses Supabase as the shared coordination point across Worker instances.
-- Only service_role may call these RPCs; raw client/IP keys are never persisted.

begin;

create table if not exists private.login_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  failures integer not null default 0 check (failures >= 0),
  window_ends_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

revoke all on private.login_rate_limits from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.login_rate_limits to service_role;

create or replace function public.check_login_rate_limit_v1(p_key_hash text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row private.login_rate_limits%rowtype;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;

  -- Serialize same-key failures even before a row exists. Row locking alone
  -- cannot protect the first concurrent insert wave because there is no row
  -- to lock yet.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_key_hash, 0)
  );

  select * into v_row
  from private.login_rate_limits
  where key_hash = p_key_hash
  for update;

  if not found then
    return query select true, 0;
    return;
  end if;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return query select false, greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer);
    return;
  end if;

  if v_row.window_ends_at <= v_now then
    delete from private.login_rate_limits where key_hash = p_key_hash;
  end if;

  return query select true, 0;
end;
$$;

create or replace function public.record_login_failure_v1(p_key_hash text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row private.login_rate_limits%rowtype;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;

  select * into v_row
  from private.login_rate_limits
  where key_hash = p_key_hash
  for update;

  if not found or v_row.window_ends_at <= v_now then
    insert into private.login_rate_limits(key_hash, failures, window_ends_at, blocked_until, updated_at)
    values(p_key_hash, 1, v_now + interval '10 minutes', null, v_now)
    on conflict(key_hash) do update
      set failures = 1,
          window_ends_at = excluded.window_ends_at,
          blocked_until = null,
          updated_at = excluded.updated_at
    returning * into v_row;
  elsif v_row.blocked_until is not null and v_row.blocked_until > v_now then
    update private.login_rate_limits
    set updated_at = v_now
    where key_hash = p_key_hash
    returning * into v_row;
  else
    update private.login_rate_limits
    set failures = failures + 1,
        blocked_until = case when failures + 1 >= 8 then v_now + interval '15 minutes' else null end,
        updated_at = v_now
    where key_hash = p_key_hash
    returning * into v_row;
  end if;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return query select false, greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer);
  else
    return query select true, 0;
  end if;
end;
$$;

create or replace function public.clear_login_failures_v1(p_key_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;

  delete from private.login_rate_limits where key_hash = p_key_hash;
end;
$$;

revoke all on function public.check_login_rate_limit_v1(text) from public, anon, authenticated;
revoke all on function public.record_login_failure_v1(text) from public, anon, authenticated;
revoke all on function public.clear_login_failures_v1(text) from public, anon, authenticated;

grant execute on function public.check_login_rate_limit_v1(text) to service_role;
grant execute on function public.record_login_failure_v1(text) to service_role;
grant execute on function public.clear_login_failures_v1(text) to service_role;

commit;
