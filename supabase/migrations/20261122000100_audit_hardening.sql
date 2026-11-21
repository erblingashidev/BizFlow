-- Audit hardening: members can no longer write activity_logs rows themselves.
--   * log_activity() becomes internal (callable only from other SECURITY DEFINER functions).
--   * Row changes on business tables are logged by an AFTER trigger with the real auth.uid().
--   * Logins are logged by the server with the service role, for a user id it has just
--     authenticated; signed-in users cannot call log_login at all.
--   * created_by is stamped from auth.uid() and cannot be supplied or changed by clients.

revoke execute on function public.log_activity(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Login logging (service role only)
-- ---------------------------------------------------------------------------
drop function public.log_login(text, text);

create or replace function public.log_login(
  p_user_id    uuid,
  p_ip         text default null,
  p_user_agent text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'unknown user' using errcode = 'P0002';
  end if;

  -- One row per active company (so each company's admins see it), or a single company-less
  -- row when the user has no company yet.
  insert into public.activity_logs (company_id, user_id, action, entity_type, entity_id, ip_address, user_agent)
  select m.company_id, p_user_id, 'auth.login', 'user', p_user_id, public.safe_inet(p_ip), left(p_user_agent, 512)
  from public.company_members m
  join public.companies c on c.id = m.company_id
  where m.user_id = p_user_id and m.status = 'active' and m.deleted_at is null and c.deleted_at is null;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    insert into public.activity_logs (company_id, user_id, action, entity_type, entity_id, ip_address, user_agent)
    values (null, p_user_id, 'auth.login', 'user', p_user_id, public.safe_inet(p_ip), left(p_user_agent, 512));
    v_count := 1;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.log_login(uuid, text, text) from public, anon, authenticated;
grant execute on function public.log_login(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- created_by: always the caller, never client-supplied, never changed afterwards.
-- ---------------------------------------------------------------------------
create or replace function public.stamp_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if v_uid is not null then
      new.created_by := v_uid;
    end if;
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['products', 'customers', 'suppliers', 'expenses', 'sales_orders', 'purchase_orders']
  loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.stamp_created_by()',
      t || '_stamp_created_by', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-change audit trigger. Args: entity name (e.g. 'product'), label column.
-- Actions: <entity>.created / updated / archived / activated / deleted / restored.
-- Updates that change nothing but updated_at are not logged.
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity  text := tg_argv[0];
  v_label   text := tg_argv[1];
  v_new     jsonb := to_jsonb(new);
  v_old     jsonb;
  v_changed text[] := '{}';
  v_action  text;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
  else
    v_old := to_jsonb(old);
    select coalesce(array_agg(n.key order by n.key), '{}')
      into v_changed
    from jsonb_each(v_new) n
    where n.key <> 'updated_at' and n.value is distinct from v_old -> n.key;

    if cardinality(v_changed) = 0 then
      return null;
    end if;

    if v_old ->> 'deleted_at' is null and v_new ->> 'deleted_at' is not null then
      v_action := 'deleted';
    elsif v_old ->> 'deleted_at' is not null and v_new ->> 'deleted_at' is null then
      v_action := 'restored';
    elsif 'is_active' = any (v_changed) and (v_new ->> 'is_active')::boolean is false then
      v_action := 'archived';
    elsif 'is_active' = any (v_changed) and (v_new ->> 'is_active')::boolean is true then
      v_action := 'activated';
    else
      v_action := 'updated';
    end if;
  end if;

  insert into public.activity_logs (company_id, user_id, action, entity_type, entity_id, metadata)
  values (
    (v_new ->> 'company_id')::uuid,
    (select auth.uid()),
    v_entity || '.' || v_action,
    v_entity,
    (v_new ->> 'id')::uuid,
    jsonb_strip_nulls(jsonb_build_object(
      'label', left(v_new ->> v_label, 200),
      'changed', case when tg_op = 'UPDATE' then to_jsonb(v_changed) end
    ))
  );
  return null;
end;
$$;

revoke execute on function public.audit_row_change() from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('warehouses',         'warehouse',        'name'),
      ('product_categories', 'product_category', 'name'),
      ('products',           'product',          'name'),
      ('customers',          'customer',         'name'),
      ('suppliers',          'supplier',         'name'),
      ('expense_categories', 'expense_category', 'name'),
      ('expenses',           'expense',          'description'),
      ('sales_orders',       'sales_order',      'order_number'),
      ('purchase_orders',    'purchase_order',   'order_number')
    ) as v(tbl, entity, label)
  loop
    execute format(
      'create trigger %I after insert or update on public.%I for each row execute function public.audit_row_change(%L, %L)',
      t.tbl || '_audit', t.tbl, t.entity, t.label);
  end loop;
end;
$$;
