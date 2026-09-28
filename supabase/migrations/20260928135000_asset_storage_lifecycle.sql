-- Recoverable storage lifecycle for lesson video/handout uploads.
--
-- Goals:
-- - persist the storage provider for every new asset
-- - bind an authorized upload intent to finalization atomically
-- - queue replaced objects for idempotent physical cleanup
-- - make abandoned uploads discoverable and retryable

begin;

alter table public.lesson_assets
  add column if not exists storage_provider text;

alter table public.lesson_assets
  drop constraint if exists lesson_assets_storage_provider_check;
alter table public.lesson_assets
  add constraint lesson_assets_storage_provider_check
  check (storage_provider is null or storage_provider in ('supabase','r2','legacy_unknown'));

create table if not exists private.asset_upload_intents_v1 (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  storage_provider text not null check (storage_provider in ('supabase','r2')),
  kind text not null check (kind in ('video','handout')),
  lesson_id uuid references public.lessons(id) on delete cascade,
  lesson_part_id uuid references public.lesson_parts(id) on delete cascade,
  object_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  state text not null default 'pending'
    check (state in ('pending','cleaning','finalized','cleaned')),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  finalized_asset_id uuid references public.lesson_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  cleaned_at timestamptz,
  check (((lesson_id is not null)::int + (lesson_part_id is not null)::int) = 1),
  unique(storage_provider, object_path)
);

create table if not exists private.asset_storage_cleanup_jobs_v1 (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.lesson_assets(id) on delete set null,
  storage_provider text not null check (storage_provider in ('supabase','r2')),
  kind text not null check (kind in ('video','handout')),
  storage_path text not null,
  state text not null default 'pending' check (state in ('pending','processing','done')),
  claimed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(storage_provider, storage_path)
);

revoke all on table private.asset_upload_intents_v1 from public, anon, authenticated;
revoke all on table private.asset_storage_cleanup_jobs_v1 from public, anon, authenticated;
grant usage on schema private to service_role;
grant select,insert,update on table private.asset_upload_intents_v1 to service_role;
grant select,insert,update on table private.asset_storage_cleanup_jobs_v1 to service_role;

create index if not exists asset_upload_intents_cleanup_v1_idx
  on private.asset_upload_intents_v1(state, expires_at, claimed_at);
create index if not exists asset_storage_cleanup_jobs_v1_idx
  on private.asset_storage_cleanup_jobs_v1(state, claimed_at, created_at);

create or replace function public.register_asset_upload_intent_v1(
  p_id uuid,
  p_user_id uuid,
  p_storage_provider text,
  p_kind text,
  p_lesson_id uuid,
  p_lesson_part_id uuid,
  p_object_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_storage_provider not in ('supabase','r2')
     or p_kind not in ('video','handout')
     or p_size_bytes <= 0
     or ((p_lesson_id is not null)::int + (p_lesson_part_id is not null)::int) <> 1
     or p_expires_at <= now()
     or p_expires_at > now() + interval '30 minutes'
  then
    raise exception 'Invalid upload intent';
  end if;

  if p_kind='handout' and p_storage_provider<>'supabase' then
    raise exception 'Invalid handout provider';
  end if;
  if p_kind='handout' and p_mime_type<>'application/pdf' then
    raise exception 'Invalid handout MIME type';
  end if;
  if p_kind='video' and p_mime_type not in ('video/mp4','video/webm') then
    raise exception 'Invalid video MIME type';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id=p_user_id and p.role='teacher' and p.status='active'
  ) then
    raise exception 'Invalid upload actor';
  end if;

  insert into private.asset_upload_intents_v1(
    id,user_id,storage_provider,kind,lesson_id,lesson_part_id,object_path,
    mime_type,size_bytes,expires_at,state
  ) values (
    p_id,p_user_id,p_storage_provider,p_kind,p_lesson_id,p_lesson_part_id,
    p_object_path,p_mime_type,p_size_bytes,p_expires_at,'pending'
  );

  return p_id;
end;
$$;

revoke all on function public.register_asset_upload_intent_v1(uuid,uuid,text,text,uuid,uuid,text,text,bigint,timestamptz)
  from public,anon,authenticated;
grant execute on function public.register_asset_upload_intent_v1(uuid,uuid,text,text,uuid,uuid,text,text,bigint,timestamptz)
  to service_role;

create or replace function public.finalize_lesson_asset_v2(
  p_upload_id uuid,
  p_kind text,
  p_storage_provider text,
  p_lesson_id uuid,
  p_lesson_part_id uuid,
  p_title text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
returns public.lesson_assets
language plpgsql
security definer
set search_path=''
as $$
declare
  v_lesson_id uuid;
  v_subject_id uuid;
  v_group_id uuid;
  v_scope_id uuid;
  v_asset public.lesson_assets%rowtype;
  v_intent private.asset_upload_intents_v1%rowtype;
begin
  if public.current_app_role() <> 'teacher' or not public.session_is_current() then
    raise exception 'Not allowed' using errcode='42501';
  end if;
  if p_kind not in ('video','handout') then raise exception 'Invalid asset kind'; end if;
  if p_storage_provider not in ('supabase','r2') then raise exception 'Invalid storage provider'; end if;
  if p_kind='handout' and p_storage_provider<>'supabase' then raise exception 'Invalid handout provider'; end if;
  if p_size_bytes <= 0 then raise exception 'Invalid asset size'; end if;
  if ((p_lesson_id is not null)::int + (p_lesson_part_id is not null)::int) <> 1 then
    raise exception 'Exactly one content parent is required';
  end if;

  select i.* into v_intent
  from private.asset_upload_intents_v1 i
  where i.id=p_upload_id
  for update;

  if not found
     or v_intent.user_id is distinct from auth.uid()
     or v_intent.storage_provider is distinct from p_storage_provider
     or v_intent.kind is distinct from p_kind
     or v_intent.lesson_id is distinct from p_lesson_id
     or v_intent.lesson_part_id is distinct from p_lesson_part_id
     or v_intent.object_path is distinct from p_storage_path
     or v_intent.mime_type is distinct from p_mime_type
     or v_intent.size_bytes is distinct from p_size_bytes
  then
    raise exception 'Invalid upload intent';
  end if;

  -- Retrying the same finalized request is safe: return the exact committed
  -- asset and never queue/delete it as its own replacement.
  if v_intent.state='finalized' and v_intent.finalized_asset_id is not null then
    select a.* into v_asset
    from public.lesson_assets a
    where a.id=v_intent.finalized_asset_id;
    if not found then raise exception 'Finalized upload asset is missing'; end if;
    return v_asset;
  end if;

  if v_intent.state<>'pending' or v_intent.expires_at < now() then
    raise exception 'Upload intent is not finalizable';
  end if;

  if p_lesson_part_id is not null then
    select p.lesson_id into v_lesson_id
    from public.lesson_parts p
    where p.id=p_lesson_part_id;
  else
    v_lesson_id := p_lesson_id;
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

  insert into private.asset_storage_cleanup_jobs_v1(
    asset_id,storage_provider,kind,storage_path,state
  )
  select a.id,a.storage_provider,a.kind,a.storage_path,'pending'
  from public.lesson_assets a
  where a.kind=p_kind
    and a.state<>'removed'
    and a.storage_provider in ('supabase','r2')
    and (
      (p_lesson_id is not null and a.lesson_id=p_lesson_id)
      or (p_lesson_part_id is not null and a.lesson_part_id=p_lesson_part_id)
    )
  on conflict (storage_provider,storage_path) do nothing;

  update public.lesson_assets a
  set state='removed'
  where a.kind=p_kind and a.state<>'removed'
    and (
      (p_lesson_id is not null and a.lesson_id=p_lesson_id)
      or (p_lesson_part_id is not null and a.lesson_part_id=p_lesson_part_id)
    );

  insert into public.lesson_assets(
    kind,lesson_id,lesson_part_id,title,storage_path,original_filename,mime_type,
    size_bytes,state,storage_provider
  ) values (
    p_kind,p_lesson_id,p_lesson_part_id,left(p_title,120),p_storage_path,
    p_original_filename,p_mime_type,p_size_bytes,'ready',p_storage_provider
  ) returning * into v_asset;

  update private.asset_upload_intents_v1 i
  set state='finalized', finalized_asset_id=v_asset.id, finalized_at=now(), claimed_at=null
  where i.id=p_upload_id;

  return v_asset;
end;
$$;

revoke all on function public.finalize_lesson_asset_v2(uuid,text,text,uuid,uuid,text,text,text,text,bigint)
  from public,anon;
grant execute on function public.finalize_lesson_asset_v2(uuid,text,text,uuid,uuid,text,text,text,text,bigint)
  to authenticated;

create or replace function public.claim_asset_storage_cleanup_jobs_v1(p_limit integer default 20)
returns table(id uuid,storage_provider text,kind text,storage_path text)
language plpgsql
security definer
set search_path=''
as $$
begin
  return query
  with selected as (
    select j.id
    from private.asset_storage_cleanup_jobs_v1 j
    where j.state='pending'
       or (j.state='processing' and j.claimed_at < now()-interval '15 minutes')
    order by j.created_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,20),100))
  ), claimed as (
    update private.asset_storage_cleanup_jobs_v1 j
    set state='processing', claimed_at=now(), attempts=j.attempts+1, last_error=null
    from selected s
    where j.id=s.id
    returning j.id,j.storage_provider,j.kind,j.storage_path
  )
  select c.id,c.storage_provider,c.kind,c.storage_path from claimed c;
end;
$$;

create or replace function public.finish_asset_storage_cleanup_job_v1(
  p_id uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update private.asset_storage_cleanup_jobs_v1 j
  set state=case when p_success then 'done' else 'pending' end,
      completed_at=case when p_success then now() else null end,
      claimed_at=null,
      last_error=case when p_success then null else left(coalesce(p_error,'cleanup failed'),1000) end
  where j.id=p_id and j.state='processing';
end;
$$;

create or replace function public.claim_stale_asset_upload_intents_v1(p_limit integer default 20)
returns table(id uuid,storage_provider text,kind text,object_path text)
language plpgsql
security definer
set search_path=''
as $$
begin
  return query
  with selected as (
    select i.id
    from private.asset_upload_intents_v1 i
    where (i.state='pending' and i.expires_at < now())
       or (i.state='cleaning' and i.claimed_at < now()-interval '15 minutes')
    order by i.expires_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,20),100))
  ), claimed as (
    update private.asset_upload_intents_v1 i
    set state='cleaning', claimed_at=now()
    from selected s
    where i.id=s.id
    returning i.id,i.storage_provider,i.kind,i.object_path
  )
  select c.id,c.storage_provider,c.kind,c.object_path from claimed c;
end;
$$;

create or replace function public.finish_stale_asset_upload_intent_v1(
  p_id uuid,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update private.asset_upload_intents_v1 i
  set state=case when p_success then 'cleaned' else 'pending' end,
      cleaned_at=case when p_success then now() else null end,
      claimed_at=null
  where i.id=p_id and i.state='cleaning';
end;
$$;

revoke all on function public.claim_asset_storage_cleanup_jobs_v1(integer) from public,anon,authenticated;
revoke all on function public.finish_asset_storage_cleanup_job_v1(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.claim_stale_asset_upload_intents_v1(integer) from public,anon,authenticated;
revoke all on function public.finish_stale_asset_upload_intent_v1(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_asset_storage_cleanup_jobs_v1(integer) to service_role;
grant execute on function public.finish_asset_storage_cleanup_job_v1(uuid,boolean,text) to service_role;
grant execute on function public.claim_stale_asset_upload_intents_v1(integer) to service_role;
grant execute on function public.finish_stale_asset_upload_intent_v1(uuid,boolean) to service_role;

create or replace function public.asset_storage_diagnostics_v1()
returns table(issue text,issue_count bigint)
language sql
stable
security definer
set search_path=''
as $$
  select 'ready_asset_without_storage_provider',count(*)::bigint
  from public.lesson_assets a
  where a.state='ready' and a.storage_provider is null
  union all
  select 'pending_asset_cleanup_job',count(*)::bigint
  from private.asset_storage_cleanup_jobs_v1 j
  where j.state<>'done'
  union all
  select 'expired_unfinalized_upload_intent',count(*)::bigint
  from private.asset_upload_intents_v1 i
  where i.state in ('pending','cleaning') and i.expires_at<now();
$$;

revoke all on function public.asset_storage_diagnostics_v1() from public,anon,authenticated;
grant execute on function public.asset_storage_diagnostics_v1() to service_role;

commit;
