-- Archive only legacy groups that are provably empty and unreferenced.
-- No generated IDs are hard-coded and no rows are deleted.

begin;

update public.groups g
set status = 'archived'
where g.status = 'active'
  and g.subject_id is null
  and not exists (
    select 1 from public.group_memberships m
    where m.group_id = g.id
  )
  and not exists (
    select 1 from public.subjects s
    where s.group_id = g.id
  )
  and not exists (
    select 1 from public.teacher_student_private_records r
    where r.group_id = g.id
  )
  and not exists (
    select 1 from public.announcements a
    where a.group_id = g.id
  );

-- Any remaining active unlinked group must have at least one real dependency.
do $$
begin
  if exists (
    select 1
    from public.groups g
    where g.status = 'active'
      and g.subject_id is null
      and not exists (select 1 from public.group_memberships m where m.group_id = g.id)
      and not exists (select 1 from public.subjects s where s.group_id = g.id)
      and not exists (select 1 from public.teacher_student_private_records r where r.group_id = g.id)
      and not exists (select 1 from public.announcements a where a.group_id = g.id)
  ) then
    raise exception 'Empty active legacy groups remain after cleanup';
  end if;
end
$$;

commit;
