-- Make lesson asset finalization retry-safe and persist cleanup work for the
-- superseded external object. Storage deletion is intentionally performed by
-- the application after commit; Postgres only records the durable cleanup task.

begin;

alter table public.lesson_assets
  add column if not exists storage_provider text not null default 'supabase';

alter table public.lesson_assets
  drop constraint if exists lesson_assets_storage_provider_check;
alter table public.lesson_assets
  add constraint lesson_assets_storage_provider_check
  check (storage_provider in ('demo','supabase','r2'));

create table if not exists private.lesson_asset_cleanup_queue_v1 (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  storage_provider text not null check (storage_provider in ('demo','supabase','r2')),
  bucket text not null check (bucket in ('lesson-videos','lesson-handouts')),
  storage_path text not null unique,
  state text not null default 'pending' check (state in ('pending','complete')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

revoke all on table private.lesson_asset_cleanup_queue_v1
  from public, anon, authenticated;
grant select, insert, update on table private.lesson_asset_cleanup_queue_v1
  to service_role;

create index if not exists lesson_asset_cleanup_pending_v1_idx
  on private.lesson_asset_cleanup_queue_v1(state, created_at)
  where state='pending';

create or replace function public.enqueue_removed_lesson_asset_cleanup_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.state <> 'removed' and new.state = 'removed'
     and old.kind in ('video','handout')
  then
    insert into private.lesson_asset_cleanup_queue_v1(
      asset_id, storage_provider, bucket, storage_path
    )
    values(
      old.id,
      coalesce(old.storage_provider,'supabase'),
      case when old.kind='video' then 'lesson-videos' else 'lesson-handouts' end,
      old.storage_path
    )
    on conflict (storage_path) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_removed_lesson_asset_cleanup_v1()
  from public, anon, authenticated;
grant execute on function public.enqueue_removed_lesson_asset_cleanup_v1()
  to service_role;

drop trigger if exists enqueue_removed_lesson_asset_cleanup_v1 on public.lesson_assets;
create trigger enqueue_removed_lesson_asset_cleanup_v1
after update of state on public.lesson_assets
for each row
when (old.state is distinct from new.state)
execute function public.enqueue_removed_lesson_asset_cleanup_v1();

create or replace function public.finalize_lesson_asset_v2(
  p_kind text,
  p_lesson_id uuid,
  p_lesson_part_id uuid,
  p_title text,
  p_storage_provider text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
returns public.lesson_assets
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_lesson_id uuid;
  v_subject_id uuid;
  v_group_id uuid;
  v_scope_id uuid;
  v_existing public.lesson_assets%rowtype;
  v_asset public.lesson_assets%rowtype;
begin
  if not public.session_is_current()
     or public.current_app_role() <> 'teacher'
  then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  if p_kind not in ('video','handout') then
    raise exception 'Invalid asset kind';
  end if;
  if p_storage_provider not in ('demo','supabase','r2') then
    raise exception 'Invalid storage provider';
  end if;
  if p_kind='handout' and p_storage_provider='r2' then
    raise exception 'R2 handouts are not enabled in Core 1.0';
  end if;
  if p_size_bytes <= 0 then
    raise exception 'Invalid asset size';
  end if;
  if ((p_lesson_id is not null)::int + (p_lesson_part_id is not null)::int) <> 1 then
    raise exception 'Exactly one content parent is required';
  end if;

  -- Lock the content parent so two concurrent replacements cannot both become
  -- the active asset for the same kind/parent.
  if p_lesson_part_id is not null then
    select p.lesson_id into v_lesson_id
    from public.lesson_parts p
    where p.id=p_lesson_part_id
    for update;
    if v_lesson_id is null then raise exception 'Invalid lesson part'; end if;
  else
    select l.id into v_lesson_id
    from public.lessons l
    where l.id=p_lesson_id
    for update;
    if v_lesson_id is null then raise exception 'Invalid lesson'; end if;
  end if;

  select s.id,s.group_id into v_subject_id,v_group_id
  from public.lessons l
  join public.subjects s on s.id=l.subject_id
  where l.id=v_lesson_id;

  if v_subject_id is null or not public.teacher_owns_lesson_v2(v_lesson_id) then
    raise exception 'Not allowed' using errcode='42501';
  end if;

  v_scope_id := coalesce(v_group_id,v_subject_id);
  if public.safe_uuid(split_part(p_storage_path,'/',1)) is distinct from v_scope_id then
    raise exception 'Invalid storage scope';
  end if;

  -- A successful finalize may be retried after the client loses the response.
  -- Return the already-ready asset instead of removing it and colliding with the
  -- unique storage_path constraint.
  select a.* into v_existing
  from public.lesson_assets a
  where a.storage_path=p_storage_path
  for update;

  if found then
    if v_existing.state='ready'
       and v_existing.kind=p_kind
       and v_existing.storage_provider=p_storage_provider
       and v_existing.lesson_id is not distinct from p_lesson_id
       and v_existing.lesson_part_id is not distinct from p_lesson_part_id
       and v_existing.mime_type=p_mime_type
       and v_existing.size_bytes=p_size_bytes
    then
      return v_existing;
    end if;
    raise exception 'Upload object path was already finalized';
  end if;

  update public.lesson_assets
  set state='removed'
  where kind=p_kind and state <> 'removed'
    and (
      (p_lesson_id is not null and lesson_id=p_lesson_id)
      or (p_lesson_part_id is not null and lesson_part_id=p_lesson_part_id)
    );

  insert into public.lesson_assets(
    kind,lesson_id,lesson_part_id,title,storage_provider,storage_path,
    original_filename,mime_type,size_bytes,state
  )
  values(
    p_kind,p_lesson_id,p_lesson_part_id,left(p_title,120),p_storage_provider,
    p_storage_path,p_original_filename,p_mime_type,p_size_bytes,'ready'
  )
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.finalize_lesson_asset_v2(text,uuid,uuid,text,text,text,text,text,bigint)
  from public, anon;
grant execute on function public.finalize_lesson_asset_v2(text,uuid,uuid,text,text,text,text,text,bigint)
  to authenticated;

create or replace function public.list_pending_lesson_asset_cleanup_v1(p_limit integer default 10)
returns table(
  id uuid,
  asset_id uuid,
  storage_provider text,
  bucket text,
  storage_path text,
  attempts integer
)
language sql
security invoker
set search_path=''
as $$
  select q.id,q.asset_id,q.storage_provider,q.bucket,q.storage_path,q.attempts
  from private.lesson_asset_cleanup_queue_v1 q
  where q.state='pending'
  order by q.created_at,q.id
  limit greatest(1,least(coalesce(p_limit,10),100));
$$;

create or replace function public.complete_lesson_asset_cleanup_v1(
  p_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  update private.lesson_asset_cleanup_queue_v1 q
  set attempts=q.attempts+1,
      state=case when p_success then 'complete' else 'pending' end,
      last_error=case when p_success then null else left(coalesce(p_error,'cleanup failed'),1000) end,
      completed_at=case when p_success then now() else null end
  where q.id=p_id;
end;
$$;

revoke all on function public.list_pending_lesson_asset_cleanup_v1(integer)
  from public, anon, authenticated;
revoke all on function public.complete_lesson_asset_cleanup_v1(uuid,boolean,text)
  from public, anon, authenticated;
grant execute on function public.list_pending_lesson_asset_cleanup_v1(integer)
  to service_role;
grant execute on function public.complete_lesson_asset_cleanup_v1(uuid,boolean,text)
  to service_role;

commit;
