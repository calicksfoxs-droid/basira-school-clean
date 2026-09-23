-- PHASE 1.7: atomic / compensating account creation.
-- The Auth HTTP boundary is reconciled in application code by a stable request UUID
-- and pre-known Auth UUID. All application rows are provisioned in one DB transaction.

create table if not exists private.account_creation_operations (
  request_id uuid primary key,
  actor_id uuid not null,
  auth_user_id uuid not null unique,
  target_role text not null check (target_role in ('teacher','student')),
  group_id uuid,
  display_name text not null check (char_length(display_name) between 2 and 80),
  public_account_ref text not null unique check (public_account_ref ~ '^[A-Z0-9]{4}$'),
  contact_number text check (contact_number is null or char_length(contact_number) <= 40),
  state text not null default 'prepared'
    check (state in ('prepared','complete','cleanup_pending','cleaned')),
  cleanup_error text,
  completed_at timestamptz,
  cleaned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_creation_target_shape check (
    (target_role='teacher' and group_id is null)
    or
    (target_role='student' and group_id is not null)
  )
);

revoke all on table private.account_creation_operations
  from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update on table private.account_creation_operations
  to service_role;

create or replace function public.prepare_account_creation_v1(
  p_request_id uuid,
  p_actor_id uuid,
  p_target_role text,
  p_group_id uuid,
  p_display_name text,
  p_public_account_ref text,
  p_contact_number text default null
)
returns table(
  request_id uuid,
  actor_id uuid,
  auth_user_id uuid,
  target_role text,
  group_id uuid,
  display_name text,
  public_account_ref text,
  synthetic_email text,
  contact_number text,
  state text
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_actor_role text;
  v_actor_status text;
  v_group_owner uuid;
  v_group_status text;
  v_op private.account_creation_operations%rowtype;
begin
  if p_target_role not in ('teacher','student') then
    raise exception 'Unsupported account role';
  end if;

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

  select p.role,p.status
  into v_actor_role,v_actor_status
  from public.profiles p
  where p.id=p_actor_id;

  if v_actor_status is distinct from 'active' then
    raise exception 'Creation actor is not active';
  end if;

  if p_target_role='teacher' then
    if v_actor_role is distinct from 'admin' or p_group_id is not null then
      raise exception 'Only Admin can create Teacher';
    end if;
  else
    if v_actor_role not in ('admin','teacher') or p_group_id is null then
      raise exception 'Student creation requires an eligible Group';
    end if;

    select g.owner_teacher_id,g.status
    into v_group_owner,v_group_status
    from public.groups g
    where g.id=p_group_id;

    if v_group_status is distinct from 'active' then
      raise exception 'Student creation requires an active Group';
    end if;

    if v_actor_role='teacher'
       and v_group_owner is distinct from p_actor_id
    then
      raise exception 'Teacher does not own target Group';
    end if;
  end if;

  select o.*
  into v_op
  from private.account_creation_operations o
  where o.request_id=p_request_id
  for update;

  if found then
    if v_op.actor_id is distinct from p_actor_id
       or v_op.target_role is distinct from p_target_role
       or v_op.group_id is distinct from p_group_id
       or v_op.display_name is distinct from trim(p_display_name)
       or v_op.contact_number is distinct from nullif(trim(p_contact_number),'')
    then
      raise exception 'Creation request does not match prior attempt';
    end if;

    if v_op.state='cleaned' then
      if exists(
        select 1
        from public.access_credentials c
        where c.public_account_ref=p_public_account_ref
      ) then
        raise exception using
          errcode='23505',
          message='Public account reference collision';
      end if;

      update private.account_creation_operations o
      set public_account_ref=p_public_account_ref,
          state='prepared',
          cleanup_error=null,
          cleaned_at=null,
          updated_at=now()
      where o.request_id=p_request_id
      returning o.* into v_op;
    end if;
  else
    if exists(
      select 1
      from public.access_credentials c
      where c.public_account_ref=p_public_account_ref
    ) then
      raise exception using
        errcode='23505',
        message='Public account reference collision';
    end if;

    insert into private.account_creation_operations(
      request_id,
      actor_id,
      auth_user_id,
      target_role,
      group_id,
      display_name,
      public_account_ref,
      contact_number,
      state
    )
    values(
      p_request_id,
      p_actor_id,
      gen_random_uuid(),
      p_target_role,
      p_group_id,
      trim(p_display_name),
      p_public_account_ref,
      nullif(trim(p_contact_number),''),
      'prepared'
    )
    returning * into v_op;
  end if;

  return query
  select
    v_op.request_id,
    v_op.actor_id,
    v_op.auth_user_id,
    v_op.target_role,
    v_op.group_id,
    v_op.display_name,
    v_op.public_account_ref,
    'basira.' || replace(v_op.auth_user_id::text,'-','') || '@access.invalid',
    v_op.contact_number,
    v_op.state;
end;
$$;

create or replace function public.get_account_creation_operation_v1(
  p_request_id uuid,
  p_actor_id uuid
)
returns table(
  request_id uuid,
  actor_id uuid,
  auth_user_id uuid,
  target_role text,
  group_id uuid,
  display_name text,
  public_account_ref text,
  synthetic_email text,
  contact_number text,
  state text,
  cleanup_error text
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_op private.account_creation_operations%rowtype;
begin
  select o.*
  into v_op
  from private.account_creation_operations o
  where o.request_id=p_request_id
    and o.actor_id=p_actor_id;

  if not found then
    raise exception 'Account creation operation not found';
  end if;

  return query
  select
    v_op.request_id,
    v_op.actor_id,
    v_op.auth_user_id,
    v_op.target_role,
    v_op.group_id,
    v_op.display_name,
    v_op.public_account_ref,
    'basira.' || replace(v_op.auth_user_id::text,'-','') || '@access.invalid',
    v_op.contact_number,
    v_op.state,
    v_op.cleanup_error;
end;
$$;

create or replace function public.set_account_creation_cleanup_v1(
  p_request_id uuid,
  p_actor_id uuid,
  p_state text,
  p_error text default null
)
returns table(
  request_id uuid,
  auth_user_id uuid,
  state text
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_op private.account_creation_operations%rowtype;
begin
  if p_state not in ('cleaned','cleanup_pending') then
    raise exception 'Invalid cleanup state';
  end if;

  select o.*
  into v_op
  from private.account_creation_operations o
  where o.request_id=p_request_id
    and o.actor_id=p_actor_id
  for update;

  if not found then
    raise exception 'Account creation operation not found';
  end if;

  if v_op.state='complete' then
    return query select v_op.request_id,v_op.auth_user_id,v_op.state;
    return;
  end if;

  update private.account_creation_operations o
  set state=p_state,
      cleanup_error=case when p_state='cleanup_pending' then left(coalesce(p_error,'cleanup pending'),1000) else null end,
      cleaned_at=case when p_state='cleaned' then now() else null end,
      updated_at=now()
  where o.request_id=p_request_id
  returning o.* into v_op;

  return query select v_op.request_id,v_op.auth_user_id,v_op.state;
end;
$$;

create or replace function public.provision_account_v1(
  p_request_id uuid,
  p_actor_id uuid
)
returns table(
  request_id uuid,
  auth_user_id uuid,
  target_role text,
  group_id uuid,
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
  v_op private.account_creation_operations%rowtype;
  v_actor_role text;
  v_actor_status text;
  v_group_owner uuid;
  v_group_status text;
  v_synthetic_email text;
begin
  select o.*
  into v_op
  from private.account_creation_operations o
  where o.request_id=p_request_id
    and o.actor_id=p_actor_id
  for update;

  if not found then
    raise exception 'Account creation operation not found';
  end if;

  v_synthetic_email :=
    'basira.' || replace(v_op.auth_user_id::text,'-','') || '@access.invalid';

  if v_op.state='complete' then
    return query
    select
      v_op.request_id,
      v_op.auth_user_id,
      v_op.target_role,
      v_op.group_id,
      v_op.display_name,
      v_op.public_account_ref,
      v_synthetic_email,
      v_op.state;
    return;
  end if;

  if v_op.state<>'prepared' then
    raise exception 'Account creation operation is not provisionable';
  end if;

  select p.role,p.status
  into v_actor_role,v_actor_status
  from public.profiles p
  where p.id=v_op.actor_id;

  if v_actor_status is distinct from 'active' then
    raise exception 'Creation actor is not active';
  end if;

  if v_op.target_role='teacher' then
    if v_actor_role is distinct from 'admin'
       or v_op.group_id is not null
    then
      raise exception 'Only Admin can create Teacher';
    end if;
  elsif v_op.target_role='student' then
    if v_actor_role not in ('admin','teacher')
       or v_op.group_id is null
    then
      raise exception 'Student creation requires an eligible Group';
    end if;

    select g.owner_teacher_id,g.status
    into v_group_owner,v_group_status
    from public.groups g
    where g.id=v_op.group_id
    for update;

    if v_group_status is distinct from 'active' then
      raise exception 'Student creation requires an active Group';
    end if;

    if v_actor_role='teacher'
       and v_group_owner is distinct from v_op.actor_id
    then
      raise exception 'Teacher does not own target Group';
    end if;
  else
    raise exception 'Unsupported account role';
  end if;

  insert into public.profiles(
    id,
    display_name,
    role,
    status,
    created_by,
    session_invalid_before
  )
  values(
    v_op.auth_user_id,
    v_op.display_name,
    v_op.target_role,
    'active',
    v_op.actor_id,
    now()
  );

  insert into public.access_credentials(
    auth_user_id,
    public_account_ref,
    synthetic_email,
    role,
    state,
    code_hint,
    issued_by
  )
  values(
    v_op.auth_user_id,
    v_op.public_account_ref,
    v_synthetic_email,
    v_op.target_role,
    'unused',
    'BSR-' || v_op.public_account_ref || '-••••••••',
    v_op.actor_id
  );

  if v_op.target_role='student' then
    insert into public.group_memberships(
      group_id,
      student_id,
      status
    )
    values(
      v_op.group_id,
      v_op.auth_user_id,
      'active'
    );

    if v_actor_role='teacher' then
      insert into public.teacher_student_private_records(
        teacher_id,
        student_id,
        group_id,
        contact_number
      )
      values(
        v_op.actor_id,
        v_op.auth_user_id,
        v_op.group_id,
        v_op.contact_number
      );
    end if;
  end if;

  update private.account_creation_operations o
  set state='complete',
      cleanup_error=null,
      completed_at=now(),
      updated_at=now()
  where o.request_id=v_op.request_id
  returning o.* into v_op;

  return query
  select
    v_op.request_id,
    v_op.auth_user_id,
    v_op.target_role,
    v_op.group_id,
    v_op.display_name,
    v_op.public_account_ref,
    v_synthetic_email,
    v_op.state;
end;
$$;

revoke all on function public.prepare_account_creation_v1(uuid,uuid,text,uuid,text,text,text)
  from public,anon,authenticated;
revoke all on function public.get_account_creation_operation_v1(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.set_account_creation_cleanup_v1(uuid,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.provision_account_v1(uuid,uuid)
  from public,anon,authenticated;

grant execute on function public.prepare_account_creation_v1(uuid,uuid,text,uuid,text,text,text)
  to service_role;
grant execute on function public.get_account_creation_operation_v1(uuid,uuid)
  to service_role;
grant execute on function public.set_account_creation_cleanup_v1(uuid,uuid,text,text)
  to service_role;
grant execute on function public.provision_account_v1(uuid,uuid)
  to service_role;
