-- PHASE 1.3: make progressive learning a database-enforced invariant.
-- Learning Core subjects progress sequentially by:
-- term_segment -> unit display_order -> lesson display_order.
-- Legacy group-scoped direct lessons remain non-sequential.

do $$
begin
  if exists (
    select 1
    from public.lessons
    where unit_id is not null
    group by unit_id, display_order
    having count(*) > 1
  ) then
    raise exception 'Duplicate learning-core lesson order exists';
  end if;
end $$;

create unique index if not exists lessons_unit_display_order_v1_unique
  on public.lessons(unit_id, display_order)
  where unit_id is not null;

create or replace function private.learning_core_ordered_published_lessons_v1(
  p_subject_id uuid
)
returns table(
  lesson_id uuid,
  unit_id uuid,
  ordinal bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id as lesson_id,
    u.id as unit_id,
    row_number() over (
      order by u.term_segment, u.display_order, l.display_order
    ) as ordinal
  from public.subjects s
  join public.subject_units u on u.subject_id = s.id
  join public.lessons l on l.subject_id = s.id and l.unit_id = u.id
  where s.id = p_subject_id
    and s.group_id is null
    and s.status = 'published'
    and u.status = 'published'
    and l.status = 'published'
  order by u.term_segment, u.display_order, l.display_order;
$$;

revoke all on function private.learning_core_ordered_published_lessons_v1(uuid)
  from public, anon, authenticated;

create or replace function public.get_learning_journey_v1(p_subject_id uuid)
returns table(
  lesson_id uuid,
  unit_id uuid,
  lesson_order bigint,
  state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_group_id uuid;
begin
  if v_student_id is null
     or not public.session_is_current()
     or public.current_app_role() <> 'student' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select s.group_id
  into v_group_id
  from public.subjects s
  where s.id = p_subject_id;

  if not found or not public.student_can_access_subject_v2(p_subject_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_group_id is not null then
    return query
    with ordered as (
      select
        l.id as lesson_id,
        l.unit_id,
        row_number() over (order by l.display_order, l.id) as ordinal
      from public.lessons l
      where l.subject_id = p_subject_id
        and l.unit_id is null
        and l.status = 'published'
        and public.student_can_access_lesson(l.id)
    )
    select
      o.lesson_id,
      o.unit_id,
      o.ordinal as lesson_order,
      case when lp.lesson_id is not null then 'completed' else 'available' end as state
    from ordered o
    left join public.learning_progress lp
      on lp.student_id = v_student_id
     and lp.lesson_id = o.lesson_id
    order by o.ordinal;
    return;
  end if;

  return query
  with ordered as (
    select *
    from private.learning_core_ordered_published_lessons_v1(p_subject_id)
  ),
  marked as (
    select
      o.lesson_id,
      o.unit_id,
      o.ordinal,
      (lp.lesson_id is not null) as completed
    from ordered o
    left join public.learning_progress lp
      on lp.student_id = v_student_id
     and lp.lesson_id = o.lesson_id
  ),
  projected as (
    select
      m.*,
      min(m.ordinal) filter (where not m.completed) over () as first_incomplete
    from marked m
  )
  select
    p.lesson_id,
    p.unit_id,
    p.ordinal as lesson_order,
    case
      when p.completed then 'completed'
      when p.ordinal = p.first_incomplete then 'available'
      else 'locked'
    end as state
  from projected p
  order by p.ordinal;
end;
$$;

revoke all on function public.get_learning_journey_v1(uuid)
  from public, anon;
grant execute on function public.get_learning_journey_v1(uuid)
  to authenticated;

create or replace function public.complete_learning_lesson_v1(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_subject_id uuid;
  v_group_id uuid;
  v_next_lesson_id uuid;
begin
  if v_student_id is null
     or not public.session_is_current()
     or public.current_app_role() <> 'student' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  perform 1
  from public.profiles p
  where p.id = v_student_id
  for update;

  if not found or not public.session_is_current() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select l.subject_id, s.group_id
  into v_subject_id, v_group_id
  from public.lessons l
  join public.subjects s on s.id = l.subject_id
  where l.id = p_lesson_id;

  if not found or not public.student_can_access_lesson(p_lesson_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.learning_progress lp
    where lp.student_id = v_student_id
      and lp.lesson_id = p_lesson_id
  ) then
    return;
  end if;

  if v_group_id is not null then
    insert into public.learning_progress(student_id, subject_id, lesson_id)
    values (v_student_id, v_subject_id, p_lesson_id)
    on conflict (student_id, lesson_id) do nothing;
    return;
  end if;

  select o.lesson_id
  into v_next_lesson_id
  from private.learning_core_ordered_published_lessons_v1(v_subject_id) o
  where not exists (
    select 1
    from public.learning_progress lp
    where lp.student_id = v_student_id
      and lp.lesson_id = o.lesson_id
  )
  order by o.ordinal
  limit 1;

  if v_next_lesson_id is distinct from p_lesson_id then
    raise exception 'Lesson is locked' using errcode = '42501';
  end if;

  insert into public.learning_progress(student_id, subject_id, lesson_id)
  values (v_student_id, v_subject_id, p_lesson_id)
  on conflict (student_id, lesson_id) do nothing;
end;
$$;

revoke all on function public.complete_learning_lesson_v1(uuid)
  from public, anon;
grant execute on function public.complete_learning_lesson_v1(uuid)
  to authenticated;

drop policy if exists learning_progress_student_self_v1
  on public.learning_progress;

create policy learning_progress_student_self_v1
on public.learning_progress
for select
to authenticated
using (
  learning_progress.student_id = (select auth.uid())
  and (select public.session_is_current())
  and public.student_in_learning_subject_v1(learning_progress.subject_id)
);
