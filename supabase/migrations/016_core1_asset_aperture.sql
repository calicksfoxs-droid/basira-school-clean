-- CORE 1.0 F2: freeze the lesson asset API boundary to MP4/WebM video and PDF handouts.
-- Legacy aid rows/bucket remain stored for compatibility, but normal authenticated
-- Teacher writes and active lesson-asset finalization are disabled for Core 1.0.

begin;

drop policy if exists storage_teacher_lesson_aids_manage_v1 on storage.objects;

create or replace function public.finalize_lesson_asset_phase13a(
  p_kind text,
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
set search_path=public,auth
as $$
declare
  v_lesson_id uuid;
  v_subject_id uuid;
  v_group_id uuid;
  v_scope_id uuid;
  v_asset public.lesson_assets%rowtype;
begin
  if public.current_app_role()<>'teacher' then raise exception 'Not allowed'; end if;
  if p_kind not in ('video','handout') then raise exception 'Invalid asset kind'; end if;

  if p_kind='video' then
    if p_mime_type not in ('video/mp4','video/webm') then raise exception 'Invalid video MIME type'; end if;
    if lower(p_storage_path) !~ '\.(mp4|webm)$' then raise exception 'Invalid video storage path'; end if;
  else
    if p_mime_type<>'application/pdf' then raise exception 'Invalid handout MIME type'; end if;
    if lower(p_storage_path) !~ '\.pdf$' then raise exception 'Invalid handout storage path'; end if;
  end if;

  if ((p_lesson_id is not null)::int + (p_lesson_part_id is not null)::int)<>1 then
    raise exception 'Exactly one content parent is required';
  end if;

  if p_lesson_part_id is not null then
    select p.lesson_id into v_lesson_id
    from public.lesson_parts p
    where p.id=p_lesson_part_id;
  else
    v_lesson_id:=p_lesson_id;
  end if;

  select s.id,s.group_id into v_subject_id,v_group_id
  from public.lessons l
  join public.subjects s on s.id=l.subject_id
  where l.id=v_lesson_id;

  if v_subject_id is null or not public.teacher_owns_lesson_v2(v_lesson_id) then
    raise exception 'Not allowed';
  end if;

  v_scope_id:=coalesce(v_group_id,v_subject_id);
  if public.safe_uuid(split_part(p_storage_path,'/',1)) is distinct from v_scope_id then
    raise exception 'Invalid storage scope';
  end if;

  update public.lesson_assets
  set state='removed'
  where kind=p_kind
    and state<>'removed'
    and (
      (p_lesson_id is not null and lesson_id=p_lesson_id)
      or (p_lesson_part_id is not null and lesson_part_id=p_lesson_part_id)
    );

  insert into public.lesson_assets(
    kind,lesson_id,lesson_part_id,title,storage_path,original_filename,mime_type,size_bytes,state
  )
  values(
    p_kind,p_lesson_id,p_lesson_part_id,left(p_title,120),p_storage_path,p_original_filename,p_mime_type,p_size_bytes,'ready'
  )
  returning * into v_asset;

  return v_asset;
end;
$$;

revoke all on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint)
  from public,anon;
grant execute on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint)
  to authenticated;

commit;
