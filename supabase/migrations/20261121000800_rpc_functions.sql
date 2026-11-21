-- Transactional RPCs. Each derives the caller from auth.uid() and checks permissions
-- itself; none trusts a role or membership supplied by the client.

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
create or replace function public.safe_inet(p_value text)
returns inet
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(btrim(p_value), '')::inet;
exception when others then
  return null;
end;
$$;

create or replace function public.log_activity(
  p_company_id  uuid,
  p_action      text,
  p_entity_type text default null,
  p_entity_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_company_id is not null and not public.is_member(p_company_id) then
    raise exception 'not a member of this company' using errcode = '42501';
  end if;

  insert into public.activity_logs (company_id, user_id, action, entity_type, entity_id, metadata)
  values (p_company_id, v_uid, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- One row per active company of the user (so each company's admins see it), or a single
-- company-less row when the user has no company yet.
create or replace function public.log_login(p_ip text default null, p_user_agent text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.activity_logs (company_id, user_id, action, entity_type, entity_id, ip_address, user_agent)
  select m.company_id, v_uid, 'auth.login', 'user', v_uid, public.safe_inet(p_ip), left(p_user_agent, 512)
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id = v_uid and m.status = 'active' and m.deleted_at is null and c.deleted_at is null;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    insert into public.activity_logs (company_id, user_id, action, entity_type, entity_id, ip_address, user_agent)
    values (null, v_uid, 'auth.login', 'user', v_uid, public.safe_inet(p_ip), left(p_user_agent, 512));
    v_count := 1;
  end if;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Document numbering (internal; used by P3 order RPCs). Format: SO-2026-00001
-- ---------------------------------------------------------------------------
create or replace function public.next_document_number(p_company_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_value bigint;
begin
  update public.document_sequences
     set next_value = next_value + 1, updated_at = now()
   where company_id = p_company_id and doc_type = p_doc_type
  returning prefix, next_value - 1 into v_prefix, v_value;

  if v_prefix is null then
    raise exception 'no document sequence for %', p_doc_type using errcode = 'P0002';
  end if;

  return format('%s-%s-%s', v_prefix,
    to_char(now() at time zone 'Europe/Belgrade', 'YYYY'), lpad(v_value::text, 5, '0'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Stock movements
-- ---------------------------------------------------------------------------

-- Internal: lock the stock level row, apply a signed delta, write the ledger entry.
-- Callers must have checked permissions.
create or replace function public.apply_stock_movement(
  p_company_id        uuid,
  p_product_id        uuid,
  p_warehouse_id      uuid,
  p_movement_type     text,
  p_delta             numeric,
  p_unit_cost         numeric default null,
  p_reference_type    text default 'manual',
  p_reference_id      uuid default null,
  p_transfer_group_id uuid default null,
  p_note              text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta numeric(14, 3) := round(p_delta, 3);
  v_current numeric(14, 3);
  v_new numeric(14, 3);
  v_row public.stock_movements;
begin
  if v_delta is null or v_delta = 0 then
    raise exception 'quantity must be non-zero' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.products p
    where p.id = p_product_id and p.company_id = p_company_id
      and p.deleted_at is null and p.track_inventory
  ) then
    raise exception 'product not found or not stock-tracked' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.warehouses w
    where w.id = p_warehouse_id and w.company_id = p_company_id
      and w.deleted_at is null and w.is_active
  ) then
    raise exception 'warehouse not found or inactive' using errcode = 'P0002';
  end if;

  insert into public.stock_levels (company_id, product_id, warehouse_id, quantity)
  values (p_company_id, p_product_id, p_warehouse_id, 0)
  on conflict (product_id, warehouse_id) do nothing;

  select quantity into v_current
  from public.stock_levels
  where product_id = p_product_id and warehouse_id = p_warehouse_id
  for update;

  v_new := v_current + v_delta;
  if v_new < 0 then
    raise exception 'insufficient stock: available %, requested %', v_current, abs(v_delta)
      using errcode = 'P0001', hint = 'insufficient_stock';
  end if;

  update public.stock_levels
     set quantity = v_new, updated_at = now()
   where product_id = p_product_id and warehouse_id = p_warehouse_id;

  insert into public.stock_movements (
    company_id, product_id, warehouse_id, movement_type, quantity, balance_after,
    unit_cost, reference_type, reference_id, transfer_group_id, note, created_by
  ) values (
    p_company_id, p_product_id, p_warehouse_id, p_movement_type, v_delta, v_new,
    p_unit_cost, p_reference_type, p_reference_id, p_transfer_group_id,
    nullif(btrim(p_note), ''), (select auth.uid())
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Public RPC for manual stock in / out / adjustment.
--   in, out:     p_quantity is a positive amount.
--   adjustment:  p_quantity is a signed correction (e.g. -2 after a stock count).
create or replace function public.record_stock_movement(
  p_company_id    uuid,
  p_product_id    uuid,
  p_warehouse_id  uuid,
  p_movement_type text,
  p_quantity      numeric,
  p_unit_cost     numeric default null,
  p_note          text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta numeric;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.has_permission(p_company_id, 'inventory.adjust') then
    raise exception 'permission denied: inventory.adjust' using errcode = '42501';
  end if;
  if p_unit_cost is not null and p_unit_cost < 0 then
    raise exception 'unit cost cannot be negative' using errcode = '22023';
  end if;

  case p_movement_type
    when 'in' then
      if p_quantity is null or p_quantity <= 0 then
        raise exception 'quantity must be positive' using errcode = '22023';
      end if;
      v_delta := p_quantity;
    when 'out' then
      if p_quantity is null or p_quantity <= 0 then
        raise exception 'quantity must be positive' using errcode = '22023';
      end if;
      v_delta := -p_quantity;
    when 'adjustment' then
      v_delta := p_quantity;
    else
      raise exception 'unsupported movement type: %', p_movement_type using errcode = '22023';
  end case;

  return public.apply_stock_movement(
    p_company_id, p_product_id, p_warehouse_id, p_movement_type, v_delta,
    p_unit_cost, 'manual', null, null, p_note
  );
end;
$$;

create or replace function public.transfer_stock(
  p_company_id        uuid,
  p_product_id        uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id   uuid,
  p_quantity          numeric,
  p_note              text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid := gen_random_uuid();
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.has_permission(p_company_id, 'inventory.transfer') then
    raise exception 'permission denied: inventory.transfer' using errcode = '42501';
  end if;
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'source and destination warehouses must differ' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive' using errcode = '22023';
  end if;

  -- Lock both stock rows in a stable order to avoid deadlocks between opposite transfers.
  insert into public.stock_levels (company_id, product_id, warehouse_id, quantity)
  select p_company_id, p_product_id, w.id, 0
  from public.warehouses w
  where w.company_id = p_company_id and w.id in (p_from_warehouse_id, p_to_warehouse_id)
  on conflict (product_id, warehouse_id) do nothing;

  perform 1 from public.stock_levels
  where product_id = p_product_id and warehouse_id in (p_from_warehouse_id, p_to_warehouse_id)
  order by warehouse_id
  for update;

  perform public.apply_stock_movement(
    p_company_id, p_product_id, p_from_warehouse_id, 'transfer_out', -p_quantity,
    null, 'transfer', v_group, v_group, p_note);
  perform public.apply_stock_movement(
    p_company_id, p_product_id, p_to_warehouse_id, 'transfer_in', p_quantity,
    null, 'transfer', v_group, v_group, p_note);

  return v_group;
end;
$$;

-- ---------------------------------------------------------------------------
-- Company onboarding: company + owner membership + trial + defaults, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.create_company(
  p_name            text,
  p_plan_code       text default 'starter',
  p_business_number text default null,
  p_vat_number      text default null,
  p_phone           text default null,
  p_city            text default null,
  p_address         text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_plan public.subscription_plans;
  v_owner_role uuid;
  v_company_id uuid;
  v_slug text;
  v_base_slug text;
  v_attempt integer := 0;
  v_owned integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'company name must be 2-120 characters' using errcode = '22023';
  end if;

  select count(*) into v_owned
  from public.companies where created_by = v_uid and deleted_at is null;
  if v_owned >= 5 and not public.is_super_admin() then
    raise exception 'company limit reached' using errcode = 'P0001', hint = 'company_limit';
  end if;

  select * into v_plan
  from public.subscription_plans
  where code = coalesce(p_plan_code, 'starter') and is_active and is_public;
  if v_plan.id is null then
    raise exception 'unknown plan: %', p_plan_code using errcode = 'P0002';
  end if;

  select id into v_owner_role from public.roles where key = 'owner' and is_system;

  insert into public.profiles (id, email)
  select u.id, u.email from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  v_base_slug := coalesce(nullif(left(public.slugify(v_name), 50), ''), 'company');
  v_base_slug := trim(both '-' from v_base_slug);
  v_slug := v_base_slug;
  while exists (select 1 from public.companies where slug = v_slug) loop
    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      raise exception 'could not allocate a unique slug' using errcode = 'P0001';
    end if;
    v_slug := v_base_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 5);
  end loop;

  insert into public.companies (name, slug, business_number, vat_number, phone, city, address, created_by)
  values (
    v_name, v_slug,
    nullif(btrim(p_business_number), ''), nullif(btrim(p_vat_number), ''),
    nullif(btrim(p_phone), ''), nullif(btrim(p_city), ''), nullif(btrim(p_address), ''),
    v_uid
  )
  returning id into v_company_id;

  insert into public.subscriptions (
    company_id, plan_id, status, billing_interval, price, currency,
    trial_ends_at, current_period_start, current_period_end
  ) values (
    v_company_id, v_plan.id,
    case when v_plan.trial_days > 0 then 'trialing' else 'active' end,
    'month', v_plan.price_monthly, v_plan.currency,
    case when v_plan.trial_days > 0 then now() + make_interval(days => v_plan.trial_days) end,
    now(),
    case when v_plan.trial_days > 0 then now() + make_interval(days => v_plan.trial_days)
         else now() + interval '1 month' end
  );

  insert into public.company_members (company_id, user_id, role_id, status, joined_at)
  values (v_company_id, v_uid, v_owner_role, 'active', now());

  insert into public.warehouses (company_id, name, code, is_default)
  values (v_company_id, 'Depoja kryesore', 'MAIN', true);

  insert into public.document_sequences (company_id, doc_type, prefix)
  values (v_company_id, 'sales_order', 'SO'), (v_company_id, 'purchase_order', 'PO');

  insert into public.expense_categories (company_id, name)
  select v_company_id, n
  from unnest(array[
    'Qiraja', 'Pagat', 'Shërbimet komunale', 'Transporti', 'Marketingu',
    'Furnizime zyre', 'Tatimet dhe taksat', 'Të tjera'
  ]) as n;

  perform public.log_activity(v_company_id, 'company.created', 'company', v_company_id,
    jsonb_build_object('plan', v_plan.code));

  return v_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: RPCs for signed-in users only; internals for nobody.
-- ---------------------------------------------------------------------------
revoke execute on function
  public.apply_stock_movement(uuid, uuid, uuid, text, numeric, numeric, text, uuid, uuid, text),
  public.next_document_number(uuid, text)
from public, anon, authenticated;

revoke execute on function
  public.log_activity(uuid, text, text, uuid, jsonb),
  public.log_login(text, text),
  public.record_stock_movement(uuid, uuid, uuid, text, numeric, numeric, text),
  public.transfer_stock(uuid, uuid, uuid, uuid, numeric, text),
  public.create_company(text, text, text, text, text, text, text),
  public.is_super_admin(),
  public.is_member(uuid),
  public.has_permission(uuid, text),
  public.member_role(uuid),
  public.my_permissions(uuid),
  public.shares_company_with(uuid)
from public, anon;

grant execute on function
  public.log_activity(uuid, text, text, uuid, jsonb),
  public.log_login(text, text),
  public.record_stock_movement(uuid, uuid, uuid, text, numeric, numeric, text),
  public.transfer_stock(uuid, uuid, uuid, uuid, numeric, text),
  public.create_company(text, text, text, text, text, text, text),
  public.is_super_admin(),
  public.is_member(uuid),
  public.has_permission(uuid, text),
  public.member_role(uuid),
  public.my_permissions(uuid),
  public.shares_company_with(uuid)
to authenticated;
