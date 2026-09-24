-- CORE 1.0 F1: enforce progressive Learning Core lesson reads.
-- Legacy group-scoped lessons remain non-sequential.

begin;

create or replace function public.student_can_access_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select exists(
    select 1
    from public.lessons l
    join public.subjects s on s.id=l.subject_id
    left join public.subject_units u on u.id=l.unit_id
    where l.id=p_lesson_id
      and l.status='published'
      and public.student_can_access_subject_v2(s.id)
      and (
        (
          s.group_id is not null
          and l.unit_id is null
        )
        or
        (
          s.group_id is null
          and l.unit_id is not null
          and u.status='published'
          and (
            exists(
              select 1
              from public.learning_progress lp
              where lp.student_id=auth.uid()
                and lp.lesson_id=l.id
            )
            or l.id = (
              select o.lesson_id
              from private.learning_core_ordered_published_lessons_v1(s.id) o
              where not exists(
                select 1
                from public.learning_progress lp2
                where lp2.student_id=auth.uid()
                  and lp2.lesson_id=o.lesson_id
              )
              order by o.ordinal
              limit 1
            )
          )
        )
      )
  )
$$;

revoke execute on function public.student_can_access_lesson(uuid)
  from public, anon;
grant execute on function public.student_can_access_lesson(uuid)
  to authenticated;

commit;
