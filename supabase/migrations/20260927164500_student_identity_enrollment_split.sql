-- Split student identity provisioning from Learning Core enrollment.
--
-- Identity creation is an Admin-only platform operation. Teachers enroll an
-- existing student into a subject group later using the student's private
-- enrollment reference. Legacy v1 account provisioning remains untouched so
-- old operations can still be reconciled safely.

begin;

create table if not exists private.student_identity_creation_operations_v2 (
  request_id uuid primary key,
  actor_id uuid not null references public.profiles(id),
  auth_user_id uuid not null unique,
  display_name text not null check (char_length(display_name) between 2 and 80),
  public_account_ref text not null unique check (public_account_ref ~ '^[A-Z0-9]{4}$'),
  state text not null default 'prepared'
    check (state in ('prepared','complete','cleanup_pending','cleaned')),
  cleanup_error text,
  completed_at timestamptz,
  cleaned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on table private.student_identity_creation_operations_v2
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update on table private.student_identity_creation_operations_v2
  to service_role;

create or replace function public.prepare_student_identity_creation_v2(
  p_request_id uuid,
  p_actor_id uuid,
  p_display_name text,
  p_public_account_ref text
)
returns table(
  request_id uuid,
  actor_id uuid,
  auth_user_id uuid,
  display_name text,
  public_account_ref text,
  synthetic_email text,
  state text,
  cleanup_error text
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_actor_role text;
  v_actor_status text;
  v_op private.student_identity_creation_operations_v2%rowtype;
begin
  if p_display_name is null
     or char_length(trim(p_display_name)) < 2
     or char_length(trim(p_display_name)) > 80
  then
    raise exception 'Invalid display name';
  end if;

  if p_public_account_ref is null
     or p_public_account_ref !~ '^[A-Z0-9]{4}$'
  then
    raise exception 'Invalid public account reference';
  end if;

  select p.role, p.status
  into v_actor_role, v_actor_status
  from public.profiles p
  where p.id = p_actor_id;

  if v_actor_role is distinct from 'admin'
     or v_actor_status is distinct from 'active'
  then
    raise exception 'Only active Admin can create Student identity';
  end if;

  select o.*
  into v_op
  from private.student_identity_creation_operations_v2 o
  where o.request_id = p_request_id
  for update;

  if found then
    if v_op.actor_id is distinct from p_actor_id
       or v_op.display_name is distinct from trim(p_display_name)
    then
      raise exception 'Creation request does not match prior attempt';
    end if;

    if v_op.state in ('complete','cleanup_pending','prepared') then
      return query
      select
        v_op.request_id,
        v_op.actor_id,
        v_op.auth_user_id,
        v_op.display_name,
        v_op.public_account_ref,
        'basira.' || replace(v_op.auth_user_id::text,'-','') || '@access.invalid',
        v_op.state,
        v_op.cleanup_error;
      return;
    end if;

    if v_op.state = 'cleaned' then
      if exists (
        select 1
        from public.access_credentials c
        where c.public_account_ref = p_public_account_ref
      ) then
        raise exception using
          errcode='23505',
          message='Public account reference collision';
      end if;

      update private.student_identity_creation_operations_v2 o
      set public_account_ref = p_public_account_ref,
          state = 'prepared',
          cleanup_error = null,
          cleaned_at = null,
          updated_at = now()
      where o.request_id = p_request_id
      returning o.* into v_op;
    end if;
  else
    if exists (
      select 1
      from public.access_credentials c
      where c.public_account_ref = p_public_account_ref
    ) then
      raise exception using
        errcode='23505',
        message='Public account reference collision';
    end if;

    insert into private.student_identity_creation_operations_v2(
      request_id, actor_id, auth_user_id, display_name, public_account_ref, state
    )
    values (
      p_request_id, p_actor_id, gen_random_uuid(), trim(p_display_name),
      p_public_account_ref, 'prepared'
    )
    returning * into v_op;
  end if;

  return query
  select
    v_op.request_id,
    v_op.actor_id,
    v_op.auth_user_id,
    v_op.display_name,
    v_op.public_account_ref,
    'basira.' || replace(v_op.auth_user_id::text,'-','') || '@access.invalid',
    v_op.state,
    v_op.cleanup_error;
end;
$$;

create or replace function public.get_student_identity_creation_operation_v2(
  p_request_id uuid,
  p_actor_id uuid
)
returns table(
  request_id uuid,
  actor_id uuid,
  auth_user_id uuid,
  display_name text,
  public_account_ref text,
  synthetic_email text,
  state text,
  cleanup_error text
)
language sql
security invoker
set search_path=''
as $$
  select
    o.request_id,
    o.actor_id,
    o.auth_user_id,
    o.display_name,
    o.public_account_ref,
    'basira.' || replace(o.auth_user_id::text,'-','') || '@access.invalid',
    o.state,
    o.cleanup_error
  from private.student_identity_creation_operations_v2 o
  where o.request_id = p_request_id
    and o.actor_id = p_actor_id;
$$;

create or replace function public.set_student_identity_creation_cleanup_v2(
  p_request_id uuid,
  p_actor_id uuid,
  p_state text,
  p_error text default null
)
returns table(request_id uuid, auth_user_id uuid, state text)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_op private.student_identity_creation_operations_v2%rowtype;
begin
  if p_state not in ('cleaned','cleanup_pending') then
    raise exception 'Invalid cleanup state';
  end if;

  select o.* into v_op
  from private.student_identity_creation_operations_v2 o
  where o.request_id = p_request_id
    and o.actor_id = p_actor_id
  for update;

  if not found then
    raise exception 'Student identity creation operation not found';
  end if;

  if v_op.state = 'complete' then
    return query select v_op.request_id, v_op.auth_user_id, v_op.state;
    return;
  end if;

  update private.student_identity_creation_operations_v2 o
  set state = p_state,
      cleanup_error = case when p_state='cleanup_pending'
        then left(coalesce(p_error,'cleanup pending'),1000) else null end,
      cleaned_at = case when p_state='cleaned' then now() else null end,
      updated_at = now()
  where o.request_id = p_request_id
  returning o.* into v_op;

  return query select v_op.request_id, v_op.auth_user_id, v_op.state;
end;
$$;

create or replace function public.provision_student_identity_v2(
  p_request_id uuid,
  p_actor_id uuid
)
returns table(
  request_id uuid,
  auth_user_id uuid,
  display_name text,
  public_account_ref text,
  synthetic_email text,
  state text
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_op private.student_identity_creation_operations_v2%rowtype;
  v_actor_role text;
  v_actor_status text;
  v_synthetic_email text;
begin
  select o.* into v_op
  from private.student_identity_creation_operations_v2 o
  where o.request_id = p_request_id
    and o.actor_id = p_actor_id
  for update;

  if not found then
    raise exception 'Student identity creation operation not found';
  end if;

  v_synthetic_email :=
    'basira.' || replace(v_op.auth_user_id::text,'-','') || '@access.invalid';

  if v_op.state = 'complete' then
    return query
    select v_op.request_id, v_op.auth_user_id, v_op.display_name,
           v_op.public_account_ref, v_synthetic_email, v_op.state;
    return;
  end if;

  if v_op.state <> 'prepared' then
    raise exception 'Student identity creation operation is not provisionable';
  end if;

  select p.role, p.status
  into v_actor_role, v_actor_status
  from public.profiles p
  where p.id = v_op.actor_id;

  if v_actor_role is distinct from 'admin'
     or v_actor_status is distinct from 'active'
  then
    raise exception 'Only active Admin can create Student identity';
  end if;

  insert into public.profiles(
    id, display_name, role, status, created_by, session_invalid_before
  )
  values(
    v_op.auth_user_id, v_op.display_name, 'student', 'active', v_op.actor_id, now()
  );

  insert into public.access_credentials(
    auth_user_id, public_account_ref, synthetic_email,
    role, state, code_hint, issued_by
  )
  values(
    v_op.auth_user_id, v_op.public_account_ref, v_synthetic_email,
    'student', 'unused', 'BSR-' || v_op.public_account_ref || '-••••••••', v_op.actor_id
  );

  -- Deliberately no group_memberships or teacher private record here.
  -- Enrollment is a later teacher action using enroll_student_by_reference_v1.

  update private.student_identity_creation_operations_v2 o
  set state='complete', cleanup_error=null, completed_at=now(), updated_at=now()
  where o.request_id=v_op.request_id
  returning o.* into v_op;

  return query
  select v_op.request_id, v_op.auth_user_id, v_op.display_name,
         v_op.public_account_ref, v_synthetic_email, v_op.state;
end;
$$;

revoke all on function public.prepare_student_identity_creation_v2(uuid,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.get_student_identity_creation_operation_v2(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.set_student_identity_creation_cleanup_v2(uuid,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.provision_student_identity_v2(uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.prepare_student_identity_creation_v2(uuid,uuid,text,text)
  to service_role;
grant execute on function public.get_student_identity_creation_operation_v2(uuid,uuid)
  to service_role;
grant execute on function public.set_student_identity_creation_cleanup_v2(uuid,uuid,text,text)
  to service_role;
grant execute on function public.provision_student_identity_v2(uuid,uuid)
  to service_role;

create index if not exists student_identity_creation_actor_v2_idx
  on private.student_identity_creation_operations_v2(actor_id, created_at desc);

commit;
