create or replace function private.ensure_teacher_workspace_v1()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if new.role = 'teacher' and new.status = 'active' then
    insert into public.curriculum_grades (
      owner_teacher_id,
      title,
      description,
      display_order,
      status
    )
    select
      new.id,
      'صف غير مصنف',
      'مساحة افتراضية للبدء. يمكنك تعديلها أو إضافة صفوف أخرى.',
      1,
      'active'
    where not exists (
      select 1
      from public.curriculum_grades
      where owner_teacher_id = new.id
        and status = 'active'
    );
  end if;
  return new;
end;
$$;

revoke all on function private.ensure_teacher_workspace_v1() from public, anon, authenticated;

drop trigger if exists profiles_ensure_teacher_workspace_v1 on public.profiles;
create trigger profiles_ensure_teacher_workspace_v1
after insert or update of role, status on public.profiles
for each row
execute function private.ensure_teacher_workspace_v1();

insert into public.curriculum_grades (
  owner_teacher_id,
  title,
  description,
  display_order,
  status
)
select
  p.id,
  'صف غير مصنف',
  'مساحة افتراضية للبدء. يمكنك تعديلها أو إضافة صفوف أخرى.',
  1,
  'active'
from public.profiles p
where p.role = 'teacher'
  and p.status = 'active'
  and not exists (
    select 1
    from public.curriculum_grades g
    where g.owner_teacher_id = p.id
      and g.status = 'active'
  );
