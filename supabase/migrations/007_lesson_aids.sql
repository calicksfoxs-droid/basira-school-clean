begin;
alter table public.lesson_assets drop constraint if exists lesson_assets_kind_check;
alter table public.lesson_assets add constraint lesson_assets_kind_check check (kind in ('video','handout','aid','submission'));
alter table public.lesson_assets drop constraint if exists asset_parent_check;
alter table public.lesson_assets add constraint asset_parent_check check (
  (kind in ('video','handout','aid') and ((lesson_id is not null)::int + (lesson_part_id is not null)::int = 1) and submission_id is null)
  or (kind='submission' and submission_id is not null and owner_student_id is not null and lesson_id is null and lesson_part_id is null)
);
create unique index if not exists one_active_aid_per_lesson on public.lesson_assets(lesson_id) where kind='aid' and state <> 'removed' and lesson_id is not null;
create unique index if not exists one_active_aid_per_part on public.lesson_assets(lesson_part_id) where kind='aid' and state <> 'removed' and lesson_part_id is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lesson-aids','lesson-aids',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy storage_teacher_lesson_aids_manage_v1 on storage.objects for all to authenticated
using (bucket_id='lesson-aids' and public.teacher_can_manage_storage_scope_v2(public.safe_uuid(split_part(name,'/',1))))
with check (bucket_id='lesson-aids' and public.teacher_can_manage_storage_scope_v2(public.safe_uuid(split_part(name,'/',1))));
create or replace function public.finalize_lesson_asset_phase13a(p_kind text,p_lesson_id uuid,p_lesson_part_id uuid,p_title text,p_storage_path text,p_original_filename text,p_mime_type text,p_size_bytes bigint)
returns public.lesson_assets language plpgsql security definer set search_path=public,auth as $$
declare v_lesson_id uuid; v_subject_id uuid; v_group_id uuid; v_scope_id uuid; v_asset public.lesson_assets%rowtype;
begin
  if public.current_app_role()<>'teacher' then raise exception 'Not allowed'; end if;
  if p_kind not in ('video','handout','aid') then raise exception 'Invalid asset kind'; end if;
  if ((p_lesson_id is not null)::int + (p_lesson_part_id is not null)::int)<>1 then raise exception 'Exactly one content parent is required'; end if;
  if p_lesson_part_id is not null then select p.lesson_id into v_lesson_id from public.lesson_parts p where p.id=p_lesson_part_id; else v_lesson_id:=p_lesson_id; end if;
  select s.id,s.group_id into v_subject_id,v_group_id from public.lessons l join public.subjects s on s.id=l.subject_id where l.id=v_lesson_id;
  if v_subject_id is null or not public.teacher_owns_lesson_v2(v_lesson_id) then raise exception 'Not allowed'; end if;
  v_scope_id:=coalesce(v_group_id,v_subject_id);
  if public.safe_uuid(split_part(p_storage_path,'/',1)) is distinct from v_scope_id then raise exception 'Invalid storage scope'; end if;
  update public.lesson_assets set state='removed' where kind=p_kind and state<>'removed' and ((p_lesson_id is not null and lesson_id=p_lesson_id) or (p_lesson_part_id is not null and lesson_part_id=p_lesson_part_id));
  insert into public.lesson_assets(kind,lesson_id,lesson_part_id,title,storage_path,original_filename,mime_type,size_bytes,state)
  values(p_kind,p_lesson_id,p_lesson_part_id,left(p_title,120),p_storage_path,p_original_filename,p_mime_type,p_size_bytes,'ready') returning * into v_asset;
  return v_asset;
end;
$$;
revoke all on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint) from public,anon;
grant execute on function public.finalize_lesson_asset_phase13a(text,uuid,uuid,text,text,text,text,bigint) to authenticated;
commit;
