-- Keep unit + default lesson creation inside one database transaction.

begin;

create or replace function public.create_subject_unit_with_lessons_v2(
  p_subject_id uuid,
  p_term_segment integer,
  p_lesson_count integer,
  p_title text,
  p_description text default null
)
returns public.subject_units
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unit public.subject_units%rowtype;
  v_index integer;
begin
  if p_lesson_count < 0 or p_lesson_count > 100 then
    raise exception 'Invalid lesson count';
  end if;

  select * into v_unit
  from public.create_subject_unit_v2(
    p_subject_id,
    p_term_segment,
    p_title,
    p_description
  );

  if p_lesson_count > 0 then
    for v_index in 1..p_lesson_count loop
      perform public.create_unit_lesson_v2(
        v_unit.id,
        'الدرس ' || v_index::text,
        null,
        'direct'
      );
    end loop;
  end if;

  return v_unit;
end;
$$;

revoke all on function public.create_subject_unit_with_lessons_v2(uuid,integer,integer,text,text) from public, anon;
grant execute on function public.create_subject_unit_with_lessons_v2(uuid,integer,integer,text,text) to authenticated;

commit;
