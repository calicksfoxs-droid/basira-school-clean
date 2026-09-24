-- CORE 1.0: shared login throttling across Cloudflare Worker instances.
-- Server-side callers send only an HMAC-SHA256 key; raw client addresses and
-- public account references are never persisted.

begin;

create table if not exists private.login_rate_limits (
  key_hash text primary key
    check (key_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null
    check (attempts >= 0),
  window_ends_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists login_rate_limits_updated_at_idx
  on private.login_rate_limits(updated_at);

revoke all on table private.login_rate_limits
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.login_rate_limits
  to service_role;

create or replace function public.begin_login_attempt_v1(p_key_hash text)
returns table(
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row private.login_rate_limits%rowtype;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;

  insert into private.login_rate_limits(
    key_hash,
    attempts,
    window_ends_at,
    blocked_until,
    updated_at
  )
  values(
    p_key_hash,
    1,
    v_now + interval '10 minutes',
    null,
    v_now
  )
  on conflict (key_hash) do nothing
  returning * into v_row;

  if found then
    return query select true, 0;
    return;
  end if;

  select *
  into v_row
  from private.login_rate_limits r
  where r.key_hash=p_key_hash
  for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    return query
    select false, greatest(1, ceil(extract(epoch from (v_row.blocked_until-v_now)))::integer);
    return;
  end if;

  if v_row.window_ends_at <= v_now then
    update private.login_rate_limits r
    set attempts=1,
        window_ends_at=v_now + interval '10 minutes',
        blocked_until=null,
        updated_at=v_now
    where r.key_hash=p_key_hash;

    return query select true, 0;
    return;
  end if;

  if v_row.attempts >= 8 then
    update private.login_rate_limits r
    set blocked_until=v_now + interval '15 minutes',
        updated_at=v_now
    where r.key_hash=p_key_hash
    returning * into v_row;

    return query
    select false, greatest(1, ceil(extract(epoch from (v_row.blocked_until-v_now)))::integer);
    return;
  end if;

  update private.login_rate_limits r
  set attempts=r.attempts + 1,
      updated_at=v_now
  where r.key_hash=p_key_hash;

  return query select true, 0;
end;
$$;

create or replace function public.clear_login_attempts_v1(p_key_hash text)
returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit key';
  end if;

  delete from private.login_rate_limits r
  where r.key_hash=p_key_hash;
end;
$$;

revoke all on function public.begin_login_attempt_v1(text)
  from public, anon, authenticated;
revoke all on function public.clear_login_attempts_v1(text)
  from public, anon, authenticated;

grant execute on function public.begin_login_attempt_v1(text)
  to service_role;
grant execute on function public.clear_login_attempts_v1(text)
  to service_role;

commit;
