-- Reference data required in every environment: system roles, permission catalog,
-- default role → permission mapping, and subscription plans. Idempotent, so it is safe
-- to re-run; plan prices/limits can be changed afterwards by a super admin.

insert into public.roles (key, name, description, scope, is_system, rank) values
  ('super_admin', 'Super Admin', 'Platform operator (BizFlow staff)', 'platform', true, 1000),
  ('owner',       'Owner',       'Full control of the company, including billing', 'company', true, 100),
  ('admin',       'Admin',       'Manages the company except billing', 'company', true, 80),
  ('manager',     'Manager',     'Runs daily operations; no deletes or staff management', 'company', true, 50),
  ('employee',    'Employee',    'Sales and basic inventory access', 'company', true, 10)
on conflict (company_id, key) do update
  set name = excluded.name, description = excluded.description, rank = excluded.rank;

insert into public.permissions (key, module, description) values
  ('dashboard.view',      'dashboard',     'View dashboard'),
  ('products.view',       'products',      'View products and categories'),
  ('products.create',     'products',      'Create products and categories'),
  ('products.update',     'products',      'Edit products and categories'),
  ('products.delete',     'products',      'Delete products and categories'),
  ('inventory.view',      'inventory',     'View stock levels and movements'),
  ('inventory.adjust',    'inventory',     'Record stock in, out and adjustments'),
  ('inventory.transfer',  'inventory',     'Transfer stock between warehouses'),
  ('warehouses.view',     'warehouses',    'View warehouses'),
  ('warehouses.create',   'warehouses',    'Create warehouses'),
  ('warehouses.update',   'warehouses',    'Edit warehouses'),
  ('warehouses.delete',   'warehouses',    'Delete warehouses'),
  ('customers.view',      'customers',     'View customers'),
  ('customers.create',    'customers',     'Create customers'),
  ('customers.update',    'customers',     'Edit customers'),
  ('customers.delete',    'customers',     'Delete customers'),
  ('suppliers.view',      'suppliers',     'View suppliers'),
  ('suppliers.create',    'suppliers',     'Create suppliers'),
  ('suppliers.update',    'suppliers',     'Edit suppliers'),
  ('suppliers.delete',    'suppliers',     'Delete suppliers'),
  ('sales.view',          'sales',         'View sales orders'),
  ('sales.create',        'sales',         'Create sales orders'),
  ('sales.update',        'sales',         'Edit and confirm sales orders'),
  ('sales.delete',        'sales',         'Delete sales orders'),
  ('purchases.view',      'purchases',     'View purchase orders'),
  ('purchases.create',    'purchases',     'Create purchase orders'),
  ('purchases.update',    'purchases',     'Edit purchase orders'),
  ('purchases.delete',    'purchases',     'Delete purchase orders'),
  ('purchases.receive',   'purchases',     'Receive purchase orders into stock'),
  ('expenses.view',       'expenses',      'View expenses'),
  ('expenses.create',     'expenses',      'Create expenses'),
  ('expenses.update',     'expenses',      'Edit expenses'),
  ('expenses.delete',     'expenses',      'Delete expenses'),
  ('reports.view',        'reports',       'View reports'),
  ('reports.export',      'reports',       'Export reports to PDF/Excel'),
  ('employees.view',      'employees',     'View team members'),
  ('employees.manage',    'employees',     'Invite, edit and suspend team members'),
  ('roles.manage',        'roles',         'Manage custom roles and permissions'),
  ('activity_logs.view',  'activity_logs', 'View the activity log'),
  ('company.settings',    'company',       'Edit company profile and settings'),
  ('billing.view',        'billing',       'View subscription and invoices'),
  ('billing.manage',      'billing',       'Change plan and payment details')
on conflict (key) do update set module = excluded.module, description = excluded.description;

with mapping(role_key, permission_key) as (
  -- owner: everything
  select 'owner', key from public.permissions
  union all
  -- admin: everything except billing management
  select 'admin', key from public.permissions where key <> 'billing.manage'
  union all
  select 'manager', unnest(array[
    'dashboard.view',
    'products.view', 'products.create', 'products.update',
    'inventory.view', 'inventory.adjust', 'inventory.transfer',
    'warehouses.view',
    'customers.view', 'customers.create', 'customers.update',
    'suppliers.view', 'suppliers.create', 'suppliers.update',
    'sales.view', 'sales.create', 'sales.update',
    'purchases.view', 'purchases.create', 'purchases.update', 'purchases.receive',
    'expenses.view', 'expenses.create', 'expenses.update',
    'reports.view', 'reports.export',
    'employees.view'
  ])
  union all
  select 'employee', unnest(array[
    'dashboard.view',
    'products.view',
    'inventory.view',
    'warehouses.view',
    'customers.view', 'customers.create',
    'sales.view', 'sales.create'
  ])
)
insert into public.role_permissions (role_id, permission_key)
select r.id, m.permission_key
from mapping m
join public.roles r on r.key = m.role_key and r.is_system and r.company_id is null
on conflict do nothing;

insert into public.subscription_plans
  (code, name, description, price_monthly, price_yearly, currency, max_employees, max_warehouses, features, trial_days, sort_order)
values
  ('starter', 'Starter', 'For small shops getting organized', 19.00, null, 'EUR', 2, null,
    '["inventory", "sales", "purchases", "expenses", "reports"]'::jsonb, 14, 10),
  ('professional', 'Professional', 'For growing teams', 39.00, null, 'EUR', 10, null,
    '["inventory", "sales", "purchases", "expenses", "reports", "exports"]'::jsonb, 14, 20),
  ('business', 'Business', 'For established businesses', 79.00, null, 'EUR', 25, null,
    '["inventory", "sales", "purchases", "expenses", "reports", "exports", "priority_support"]'::jsonb, 14, 30)
on conflict (code) do nothing;
