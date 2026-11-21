-- Authorization helpers used by RLS policies and RPCs, plus guard triggers that enforce
-- rules RLS alone cannot express (immutable tenant, soft-delete permission, role changes,
-- plan seat limits).
--
-- All helpers are SECURITY DEFINER with an empty search_path so they can read membership
-- tables without recursing through RLS, and they always derive the user from auth.uid().

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())
  );
$$;

-- Active membership in an active, non-deleted company.
create or replace function public.is_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.deleted_at is null
      and c.status = 'active'
      and c.deleted_at is null
  );
$$;

create or replace function public.has_permission(p_company_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members m
    join public.companies c on c.id = m.company_id
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.company_id = p_company_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.deleted_at is null
      and c.status = 'active'
      and c.deleted_at is null
      and rp.permission_key = p_permission
  );
$$;

create or replace function public.member_role(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.key
  from public.company_members m
  join public.companies c on c.id = m.company_id
  join public.roles r on r.id = m.role_id
  where m.company_id = p_company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.deleted_at is null
    and c.status = 'active'
    and c.deleted_at is null;
$$;

create or replace function public.my_permissions(p_company_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select rp.permission_key
  from public.company_members m
  join public.companies c on c.id = m.company_id
  join public.role_permissions rp on rp.role_id = m.role_id
  where m.company_id = p_company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.deleted_at is null
    and c.status = 'active'
    and c.deleted_at is null
  order by 1;
$$;

-- True when the current user and p_user_id are active members of a common company.
create or replace function public.shares_company_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members me
    join public.company_members other on other.company_id = me.company_id
    where me.user_id = (select auth.uid())
      and me.status = 'active' and me.deleted_at is null
      and other.user_id = p_user_id
      and other.deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Generic tenant row guard: company_id is immutable, and soft delete / restore
-- requires `<module>.delete`. TG_ARGV[0] is the permission module.
-- Requests without a user (service role, migrations) are trusted.
-- ---------------------------------------------------------------------------
create or replace function public.tenant_row_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_row_old jsonb := to_jsonb(old);
  v_row_new jsonb := to_jsonb(new);
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id cannot be changed' using errcode = '42501';
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  if v_row_new ? 'deleted_at'
     and (v_row_old ->> 'deleted_at') is distinct from (v_row_new ->> 'deleted_at')
     and not public.has_permission(new.company_id, tg_argv[0] || '.delete') then
    raise exception 'permission denied: %.delete', tg_argv[0] using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('warehouses', 'warehouses'),
      ('product_categories', 'products'),
      ('products', 'products'),
      ('customers', 'customers'),
      ('suppliers', 'suppliers'),
      ('sales_orders', 'sales'),
      ('sales_order_items', 'sales'),
      ('purchase_orders', 'purchases'),
      ('purchase_order_items', 'purchases'),
      ('expense_categories', 'expenses'),
      ('expenses', 'expenses')
    ) as v(tbl, module)
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.tenant_row_guard(%L)',
      t.tbl || '_tenant_guard', t.tbl, t.module
    );
  end loop;
end;
$$;

-- Company owners can edit their profile, but status (suspension) is platform-controlled.
create or replace function public.companies_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not public.is_super_admin()
     and (new.status is distinct from old.status
          or new.deleted_at is distinct from old.deleted_at
          or new.created_by is distinct from old.created_by) then
    raise exception 'permission denied: company status is platform-managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger companies_guard before update on public.companies
  for each row execute function public.companies_guard();

-- ---------------------------------------------------------------------------
-- Membership guard: prevents privilege escalation and orphaned companies.
-- ---------------------------------------------------------------------------
create or replace function public.company_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new_role public.roles%rowtype;
  v_old_role_key text;
  v_caller_role text;
  v_has_owner boolean;
begin
  select * into v_new_role from public.roles where id = new.role_id;

  if v_new_role.scope <> 'company'
     or (v_new_role.company_id is not null and v_new_role.company_id <> new.company_id) then
    raise exception 'role % is not assignable in this company', v_new_role.key using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' then
    if new.company_id <> old.company_id or new.user_id <> old.user_id then
      raise exception 'membership company and user are immutable' using errcode = '42501';
    end if;
    select key into v_old_role_key from public.roles where id = old.role_id;
  end if;

  if v_uid is null then
    return new;
  end if;

  v_caller_role := public.member_role(new.company_id);

  if tg_op = 'INSERT' and v_new_role.key = 'owner' and v_new_role.is_system then
    -- The creator of a company may become its first owner (done by create_company).
    select exists (
      select 1 from public.company_members m
      join public.roles r on r.id = m.role_id
      where m.company_id = new.company_id and r.key = 'owner' and r.is_system and m.deleted_at is null
    ) into v_has_owner;

    if not v_has_owner
       and new.user_id = v_uid
       and exists (select 1 from public.companies c where c.id = new.company_id and c.created_by = v_uid) then
      return new;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.user_id = v_uid
     and (new.role_id <> old.role_id or new.status <> old.status
          or new.deleted_at is distinct from old.deleted_at)
     and not (old.status = 'invited' and new.status = 'active'
              and new.role_id = old.role_id and new.deleted_at is null) then
    raise exception 'you cannot change your own role or status' using errcode = '42501';
  end if;

  if (v_new_role.key = 'owner' and v_new_role.is_system) or v_old_role_key = 'owner' then
    if v_caller_role is distinct from 'owner' then
      raise exception 'only owners can grant or change the owner role' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' and v_old_role_key = 'owner' and old.status = 'active' and old.deleted_at is null
     and (v_new_role.key <> 'owner' or new.status <> 'active' or new.deleted_at is not null) then
    if not exists (
      select 1 from public.company_members m
      join public.roles r on r.id = m.role_id
      where m.company_id = new.company_id and m.id <> new.id
        and r.key = 'owner' and r.is_system and m.status = 'active' and m.deleted_at is null
    ) then
      raise exception 'a company must keep at least one active owner' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger company_members_guard before insert or update on public.company_members
  for each row execute function public.company_members_guard();

-- Seat limit from the company's live subscription plan. Owners don't consume seats.
create or replace function public.enforce_member_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_plan_found boolean;
  v_used integer;
  v_is_owner boolean;
begin
  if new.deleted_at is not null or new.status = 'suspended' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status <> 'suspended' and old.deleted_at is null
     and old.role_id = new.role_id then
    return new;
  end if;

  select r.key = 'owner' and r.is_system into v_is_owner from public.roles r where r.id = new.role_id;
  if v_is_owner then
    return new;
  end if;

  select true, p.max_employees into v_plan_found, v_limit
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.company_id = new.company_id and s.status in ('trialing', 'active', 'past_due');

  if not coalesce(v_plan_found, false) then
    raise exception 'company has no live subscription' using errcode = 'P0001';
  end if;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_used
  from public.company_members m
  join public.roles r on r.id = m.role_id
  where m.company_id = new.company_id
    and m.id <> new.id
    and m.deleted_at is null
    and m.status <> 'suspended'
    and not (r.key = 'owner' and r.is_system);

  if v_used + 1 > v_limit then
    raise exception 'plan seat limit reached (% employees)', v_limit
      using errcode = 'P0001', hint = 'plan_seat_limit';
  end if;

  return new;
end;
$$;

create trigger company_members_seat_limit before insert or update on public.company_members
  for each row execute function public.enforce_member_seat_limit();

-- Trigger functions are not callable as RPCs.
revoke execute on function
  public.tenant_row_guard(),
  public.companies_guard(),
  public.company_members_guard(),
  public.enforce_member_seat_limit(),
  public.handle_new_user(),
  public.handle_user_email_change(),
  public.prevent_stock_movement_mutation(),
  public.set_updated_at()
from public, anon, authenticated;
