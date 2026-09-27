-- Repair only deterministic legacy -> Learning Core gaps.
-- No generated IDs are hard-coded and no content is auto-published.

begin;

-- A legacy group may only be attached automatically when the mapping is
-- unambiguous: the teacher has exactly one non-archived root Learning Core
-- subject and exactly one active unlinked group that currently has active
-- student membership. Empty duplicate legacy groups are intentionally untouched.
do $$
declare
  v_ambiguous bigint;
begin
  with root_subject_counts as (
    select s.owner_teacher_id, count(*) as subject_count
    from public.subjects s
    where s.group_id is null and s.status <> 'archived'
    group by s.owner_teacher_id
  ), membership_group_counts as (
    select g.owner_teacher_id, count(*) as group_count
    from public.groups g
    where g.subject_id is null
      and g.status = 'active'
      and exists (
        select 1 from public.group_memberships m
        where m.group_id = g.id and m.status = 'active'
      )
    group by g.owner_teacher_id
  )
  select count(*) into v_ambiguous
  from membership_group_counts mg
  join root_subject_counts rs using (owner_teacher_id)
  where mg.group_count > 1 or rs.subject_count > 1;

  if v_ambiguous > 0 then
    raise exception 'Ambiguous legacy group to Learning Core subject mapping';
  end if;
end
$$;

-- The integrity trigger intentionally makes subject_id immutable at runtime.
-- Disable only that trigger inside this migration transaction, repair the
-- deterministic NULL -> subject linkage, then immediately restore it.
drop trigger if exists enforce_subject_group_owner_v1 on public.groups;

with unique_root_subject as (
  select s.owner_teacher_id, min(s.id) as subject_id
  from public.subjects s
  where s.group_id is null and s.status <> 'archived'
  group by s.owner_teacher_id
  having count(*) = 1
), unique_membership_group as (
  select g.owner_teacher_id, min(g.id) as group_id
  from public.groups g
  where g.subject_id is null
    and g.status = 'active'
    and exists (
      select 1 from public.group_memberships m
      where m.group_id = g.id and m.status = 'active'
    )
  group by g.owner_teacher_id
  having count(*) = 1
)
update public.groups g
set subject_id = rs.subject_id
from unique_root_subject rs
join unique_membership_group mg using (owner_teacher_id)
where g.id = mg.group_id
  and g.owner_teacher_id = rs.owner_teacher_id
  and g.subject_id is null;

create trigger enforce_subject_group_owner_v1
before insert or update of subject_id, owner_teacher_id
on public.groups
for each row
execute function public.enforce_subject_group_owner_v1();

-- Restore the canonical default unit skeleton only for root subjects that have
-- no non-archived units at all. Partially-authored subjects are never guessed.
insert into public.subject_units(subject_id, term_segment, title, display_order, status)
select
  s.id,
  term.term_segment,
  unit_no.title,
  unit_no.display_order,
  'draft'
from public.subjects s
cross join (
  values (1), (2), (3), (4)
) as term(term_segment)
cross join (
  values (1, 'الوحدة الأولى'), (2, 'الوحدة الثانية')
) as unit_no(display_order, title)
where s.group_id is null
  and s.status <> 'archived'
  and not exists (
    select 1 from public.subject_units existing
    where existing.subject_id = s.id and existing.status <> 'archived'
  );

-- Postconditions: repaired active memberships must no longer terminate at an
-- unlinked group when an unambiguous single-subject mapping existed.
do $$
begin
  if exists (
    with root_subject_counts as (
      select s.owner_teacher_id, count(*) as subject_count
      from public.subjects s
      where s.group_id is null and s.status <> 'archived'
      group by s.owner_teacher_id
    ), membership_group_counts as (
      select g.owner_teacher_id, count(*) as group_count
      from public.groups g
      where g.subject_id is null
        and g.status = 'active'
        and exists (
          select 1 from public.group_memberships m
          where m.group_id = g.id and m.status = 'active'
        )
      group by g.owner_teacher_id
    )
    select 1
    from membership_group_counts mg
    join root_subject_counts rs using (owner_teacher_id)
    where mg.group_count = 1 and rs.subject_count = 1
  ) then
    raise exception 'Deterministic Learning Core graph repair did not converge';
  end if;
end
$$;

commit;
