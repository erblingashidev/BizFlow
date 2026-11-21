-- Row Level Security for every table, plus table/function privileges.
-- Tenant isolation: every tenant row is visible/writable only through has_permission()
-- for the row's own company_id. There are no DELETE policies on business tables:
-- rows are soft-deleted via UPDATE of deleted_at (guarded by tenant_row_guard).

-- ---------------------------------------------------------------------------
-- Privileges. Supabase grants ALL on public tables to anon/authenticated by default;
-- narrow that first, then let RLS decide row access.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

grant select on public.subscription_plans to anon;

revoke insert, update, delete on
  public.platform_admins,
  public.permissions,
  public.stock_levels,
  public.stock_movements,
  public.activity_logs,
  public.subscriptions,
  public.billing_invoices,
  public.billing_payments,
  public.document_sequences
from authenticated;

revoke insert, delete on public.companies, public.profiles from authenticated;
revoke delete on public.company_members from authenticated;

-- Only the user-editable profile columns.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_path, locale) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'platform_admins', 'companies', 'roles', 'permissions', 'role_permissions',
    'company_members', 'subscription_plans', 'subscriptions', 'billing_invoices', 'billing_payments',
    'warehouses', 'product_categories', 'products', 'stock_levels', 'stock_movements',
    'customers', 'suppliers', 'document_sequences', 'sales_orders', 'sales_order_items',
    'purchase_orders', 'purchase_order_items', 'expense_categories', 'expenses', 'activity_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_company_with(id) or public.is_super_admin());

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Tenancy & RBAC
-- ---------------------------------------------------------------------------
create policy companies_select on public.companies for select to authenticated
  using (public.is_member(id) or public.is_super_admin());

create policy companies_update on public.companies for update to authenticated
  using (public.has_permission(id, 'company.settings') or public.is_super_admin())
  with check (public.has_permission(id, 'company.settings') or public.is_super_admin());

create policy roles_select on public.roles for select to authenticated
  using (
    (company_id is null and scope = 'company')
    or (company_id is not null and public.is_member(company_id))
    or public.is_super_admin()
  );

create policy roles_insert on public.roles for insert to authenticated
  with check (company_id is not null and not is_system and public.has_permission(company_id, 'roles.manage'));

create policy roles_update on public.roles for update to authenticated
  using (company_id is not null and not is_system and public.has_permission(company_id, 'roles.manage'))
  with check (company_id is not null and not is_system and public.has_permission(company_id, 'roles.manage'));

create policy roles_delete on public.roles for delete to authenticated
  using (company_id is not null and not is_system and public.has_permission(company_id, 'roles.manage'));

create policy permissions_select on public.permissions for select to authenticated
  using (true);

create policy role_permissions_select on public.role_permissions for select to authenticated
  using (exists (
    select 1 from public.roles r
    where r.id = role_permissions.role_id
      and ((r.company_id is null and r.scope = 'company')
           or (r.company_id is not null and public.is_member(r.company_id))
           or public.is_super_admin())
  ));

create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check (exists (
    select 1 from public.roles r
    where r.id = role_permissions.role_id and r.company_id is not null and not r.is_system
      and public.has_permission(r.company_id, 'roles.manage')
      -- cannot hand out permissions you don't hold yourself
      and public.has_permission(r.company_id, role_permissions.permission_key)
  ));

create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (exists (
    select 1 from public.roles r
    where r.id = role_permissions.role_id and r.company_id is not null and not r.is_system
      and public.has_permission(r.company_id, 'roles.manage')
  ));

create policy company_members_select on public.company_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission(company_id, 'employees.view')
    or public.is_super_admin()
  );

-- New members always start as invitations; activation happens on acceptance.
create policy company_members_insert on public.company_members for insert to authenticated
  with check (public.has_permission(company_id, 'employees.manage') and status = 'invited');

create policy company_members_update on public.company_members for update to authenticated
  using (public.has_permission(company_id, 'employees.manage'))
  with check (public.has_permission(company_id, 'employees.manage'));

-- ---------------------------------------------------------------------------
-- Billing (read-only for tenants; written by RPCs, service role, or super admins)
-- ---------------------------------------------------------------------------
create policy subscription_plans_select_public on public.subscription_plans for select to anon
  using (is_active and is_public);

create policy subscription_plans_select on public.subscription_plans for select to authenticated
  using (is_active or public.is_super_admin());

create policy subscription_plans_insert on public.subscription_plans for insert to authenticated
  with check (public.is_super_admin());

create policy subscription_plans_update on public.subscription_plans for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_member(company_id) or public.is_super_admin());

create policy billing_invoices_select on public.billing_invoices for select to authenticated
  using (public.has_permission(company_id, 'billing.view') or public.is_super_admin());

create policy billing_payments_select on public.billing_payments for select to authenticated
  using (public.has_permission(company_id, 'billing.view') or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Standard tenant tables: <module>.view / .create / .update
-- ---------------------------------------------------------------------------
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
      ('purchase_orders', 'purchases'),
      ('expense_categories', 'expenses'),
      ('expenses', 'expenses')
    ) as v(tbl, module)
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_permission(company_id, %L))',
      t.tbl || '_select', t.tbl, t.module || '.view');
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_permission(company_id, %L))',
      t.tbl || '_insert', t.tbl, t.module || '.create');
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_permission(company_id, %L)) with check (public.has_permission(company_id, %L))',
      t.tbl || '_update', t.tbl, t.module || '.update', t.module || '.update');
  end loop;
end;
$$;

-- Line items: readable with the module's view permission; editable only while the parent
-- order is a draft.
create policy sales_order_items_select on public.sales_order_items for select to authenticated
  using (public.has_permission(company_id, 'sales.view'));

create policy sales_order_items_insert on public.sales_order_items for insert to authenticated
  with check (
    public.has_permission(company_id, 'sales.create')
    and exists (select 1 from public.sales_orders o
                where o.id = sales_order_items.sales_order_id
                  and o.company_id = sales_order_items.company_id and o.status = 'draft')
  );

create policy sales_order_items_update on public.sales_order_items for update to authenticated
  using (
    public.has_permission(company_id, 'sales.update')
    and exists (select 1 from public.sales_orders o
                where o.id = sales_order_items.sales_order_id
                  and o.company_id = sales_order_items.company_id and o.status = 'draft')
  )
  with check (
    public.has_permission(company_id, 'sales.update')
    and exists (select 1 from public.sales_orders o
                where o.id = sales_order_items.sales_order_id
                  and o.company_id = sales_order_items.company_id and o.status = 'draft')
  );

create policy sales_order_items_delete on public.sales_order_items for delete to authenticated
  using (
    public.has_permission(company_id, 'sales.update')
    and exists (select 1 from public.sales_orders o
                where o.id = sales_order_items.sales_order_id
                  and o.company_id = sales_order_items.company_id and o.status = 'draft')
  );

create policy purchase_order_items_select on public.purchase_order_items for select to authenticated
  using (public.has_permission(company_id, 'purchases.view'));

create policy purchase_order_items_insert on public.purchase_order_items for insert to authenticated
  with check (
    public.has_permission(company_id, 'purchases.create')
    and exists (select 1 from public.purchase_orders o
                where o.id = purchase_order_items.purchase_order_id
                  and o.company_id = purchase_order_items.company_id and o.status = 'draft')
  );

create policy purchase_order_items_update on public.purchase_order_items for update to authenticated
  using (
    public.has_permission(company_id, 'purchases.update')
    and exists (select 1 from public.purchase_orders o
                where o.id = purchase_order_items.purchase_order_id
                  and o.company_id = purchase_order_items.company_id and o.status = 'draft')
  )
  with check (
    public.has_permission(company_id, 'purchases.update')
    and exists (select 1 from public.purchase_orders o
                where o.id = purchase_order_items.purchase_order_id
                  and o.company_id = purchase_order_items.company_id and o.status = 'draft')
  );

create policy purchase_order_items_delete on public.purchase_order_items for delete to authenticated
  using (
    public.has_permission(company_id, 'purchases.update')
    and exists (select 1 from public.purchase_orders o
                where o.id = purchase_order_items.purchase_order_id
                  and o.company_id = purchase_order_items.company_id and o.status = 'draft')
  );

-- ---------------------------------------------------------------------------
-- Read-only tenant tables (written by SECURITY DEFINER functions only)
-- ---------------------------------------------------------------------------
create policy stock_levels_select on public.stock_levels for select to authenticated
  using (public.has_permission(company_id, 'inventory.view'));

create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.has_permission(company_id, 'inventory.view'));

create policy document_sequences_select on public.document_sequences for select to authenticated
  using (public.is_member(company_id));

create policy activity_logs_select on public.activity_logs for select to authenticated
  using (
    user_id = (select auth.uid())
    or (company_id is not null and public.has_permission(company_id, 'activity_logs.view'))
    or public.is_super_admin()
  );
