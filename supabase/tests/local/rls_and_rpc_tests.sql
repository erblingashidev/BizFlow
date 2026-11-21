-- Behavioural tests for tenant isolation, RBAC, guards and RPCs.
-- Run with scripts/db-test-local.sh (plain Postgres + supabase_stub.sql). Every check
-- raises on failure, so the run stops at the first broken expectation.

\set ON_ERROR_STOP 1
\set QUIET 1

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.as_user(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;

create function tests.as_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', false);
$$;

create function tests.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAIL: %', p_label;
  end if;
  raise notice 'ok - %', p_label;
end;
$$;

-- Asserts that p_sql raises; p_expected matches SQLSTATE or a substring of the message.
create function tests.throws(p_sql text, p_expected text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_expected or position(p_expected in sqlerrm) > 0 then
      raise notice 'ok - % (raised %: %)', p_label, sqlstate, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % - expected %, got %: %', p_label, p_expected, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % - expected an error, none raised', p_label;
end;
$$;

create function tests.count_of(p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into v;
  return v;
end;
$$;

create function tests.affected(p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute p_sql;
  get diagnostics v = row_count;
  return v;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Users. Signup trigger must create profiles.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test.local', '{"full_name":"Arta Owner"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin-a@test.local', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'manager-a@test.local', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'employee-a@test.local', '{"locale":"en"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'extra-a@test.local', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test.local', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'super@test.local', '{}');

select tests.ok((select count(*) = 7 from public.profiles), 'signup trigger creates profiles');
select tests.ok((select full_name = 'Arta Owner' and locale = 'sq' from public.profiles
                 where id = '00000000-0000-0000-0000-0000000000a1'), 'profile copies metadata, default locale sq');
select tests.ok((select locale = 'en' from public.profiles
                 where id = '00000000-0000-0000-0000-0000000000a4'), 'profile honours locale metadata');

-- ---------------------------------------------------------------------------
-- Onboarding via create_company (as the signed-in user).
-- ---------------------------------------------------------------------------
select tests.as_anon();
set role anon;
select tests.throws($$select public.create_company('Anon Co')$$, '42501', 'anon cannot call create_company');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
set role authenticated;
select public.create_company('Alfa Tregti SH.P.K.', 'starter', '811234567', null, '+383 44 123 456', 'Prishtinë') as company_a \gset
select tests.throws($$select public.create_company('X')$$, '22023', 'company name length validated');
select tests.throws($$select public.create_company('Valid Name', 'enterprise')$$, 'P0002', 'unknown plan rejected');
select tests.throws($$insert into public.companies (name, slug) values ('Direct', 'direct')$$, '42501',
  'companies cannot be inserted directly');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000000b1');
set role authenticated;
select public.create_company('Beta Market', 'professional') as company_b \gset
select public.create_company('Alfa Tregti SH.P.K.') as company_b2 \gset
reset role;

select tests.ok((select slug = 'alfa-tregti-sh-p-k' from public.companies where id = :'company_a'), 'slug generated');
select tests.ok((select slug <> 'alfa-tregti-sh-p-k' and slug like 'alfa-tregti-sh-p-k-%'
                 from public.companies where id = :'company_b2'), 'slug collision gets suffix');
select tests.ok((select r.key = 'owner' and m.status = 'active'
                 from public.company_members m join public.roles r on r.id = m.role_id
                 where m.company_id = :'company_a'), 'creator becomes active owner');
select tests.ok((select s.status = 'trialing' and s.price = 19.00
                   and s.trial_ends_at between now() + interval '13 days' and now() + interval '15 days'
                 from public.subscriptions s where s.company_id = :'company_a'), 'starter trial subscription created');
select tests.ok((select count(*) = 1 from public.warehouses where company_id = :'company_a' and is_default),
  'default warehouse created');
select tests.ok((select count(*) = 8 from public.expense_categories where company_id = :'company_a'),
  'default expense categories created');
select tests.ok((select count(*) = 1 from public.activity_logs where company_id = :'company_a' and action = 'company.created'),
  'company.created logged');

-- ---------------------------------------------------------------------------
-- Team setup (as service role / SQL console, bypassing invitation flow).
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', false);
insert into public.company_members (company_id, user_id, role_id, status)
select :'company_a', u.id, r.id, 'active'
from (values ('00000000-0000-0000-0000-0000000000a2'::uuid, 'admin'),
             ('00000000-0000-0000-0000-0000000000a3'::uuid, 'manager')) as u(id, role_key)
join public.roles r on r.key = u.role_key and r.is_system;

select tests.throws(format($$insert into public.company_members (company_id, user_id, role_id, status)
  select %L, '00000000-0000-0000-0000-0000000000a4', id, 'active' from public.roles where key = 'employee'$$, :'company_a'),
  'plan seat limit reached', 'starter plan seat limit (2 non-owners) enforced');
select tests.throws(format($$insert into public.company_members (company_id, user_id, role_id, status)
  select %L, '00000000-0000-0000-0000-0000000000a4', id, 'active' from public.roles where key = 'super_admin'$$, :'company_a'),
  'not assignable', 'platform role cannot be assigned in a company');

-- Upgrade A to Professional so the employee fits.
update public.subscriptions set plan_id = (select id from public.subscription_plans where code = 'professional')
where company_id = :'company_a';
insert into public.company_members (company_id, user_id, role_id, status)
select :'company_a', '00000000-0000-0000-0000-0000000000a4', id, 'active' from public.roles where key = 'employee';
select tests.ok((select count(*) = 4 from public.company_members where company_id = :'company_a'), 'team of four after upgrade');

-- ---------------------------------------------------------------------------
-- Tenant isolation.
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000000a1');
set role authenticated;

select tests.ok(tests.count_of('select 1 from public.companies') = 1, 'owner A sees only company A');
select tests.ok(public.is_member(:'company_a') and not public.is_member(:'company_b'), 'is_member scoped to own company');
select tests.ok(public.has_permission(:'company_a', 'billing.manage'), 'owner has billing.manage');
select tests.ok(not public.has_permission(:'company_b', 'products.view'), 'no permissions in foreign company');
select tests.ok(public.member_role(:'company_a') = 'owner', 'member_role resolves owner');
select tests.ok((select count(*) = 42 from public.my_permissions(:'company_a')), 'owner holds all permissions');
select tests.ok(tests.count_of(format('select 1 from public.warehouses where company_id = %L', :'company_b')) = 0,
  'foreign warehouses invisible');
select tests.ok(tests.count_of('select 1 from public.subscriptions') = 1, 'only own subscription visible');

insert into public.products (company_id, sku, name, sale_price, purchase_price, min_stock)
values (:'company_a', 'KAF-001', 'Kafe 500g', 4.50, 3.10, 5)
returning id as product_a \gset

select tests.throws(format($$insert into public.products (company_id, sku, name) values (%L, 'HACK', 'Hack')$$, :'company_b'),
  '42501', 'cannot insert product into foreign company');
select tests.ok(tests.affected(format($$update public.warehouses set name = 'pwned' where company_id = %L$$, :'company_b')) = 0,
  'cannot update foreign rows');
select tests.throws(format($$update public.products set company_id = %L where id = %L$$, :'company_b', :'product_a'),
  '42501', 'company_id is immutable');
select tests.throws($$insert into public.products (company_id, sku, name) values ($$ || quote_literal(:'company_a') || $$, 'kaf-001', 'Dup')$$,
  '23505', 'SKU unique per company (case-insensitive)');
select tests.throws(format($$insert into public.products (company_id, sku, name, sale_price) values (%L, 'NEG', 'Neg', -1)$$, :'company_a'),
  '23514', 'negative price rejected by check constraint');
reset role;

-- Cross-tenant composite FK: company B product cannot point at company A category.
insert into public.product_categories (company_id, name) values (:'company_a', 'Pije') returning id as category_a \gset
select tests.throws(format($$insert into public.products (company_id, category_id, sku, name) values (%L, %L, 'X1', 'X')$$,
  :'company_b', :'category_a'), '23503', 'composite FK blocks cross-tenant category reference');

-- ---------------------------------------------------------------------------
-- Stock movements.
-- ---------------------------------------------------------------------------
select id as warehouse_a from public.warehouses where company_id = :'company_a' and is_default \gset
select id as warehouse_b from public.warehouses where company_id = :'company_b' and is_default \gset

select tests.as_user('00000000-0000-0000-0000-0000000000a1');
set role authenticated;

insert into public.warehouses (company_id, name, code) values (:'company_a', 'Depo Prizren', 'PZ')
returning id as warehouse_a2 \gset

select (public.record_stock_movement(:'company_a', :'product_a', :'warehouse_a', 'in', 10, 3.10, 'Opening')).balance_after as bal \gset
select tests.ok(:'bal'::numeric = 10, 'stock in: balance 10');
select (public.record_stock_movement(:'company_a', :'product_a', :'warehouse_a', 'out', 3)).balance_after as bal \gset
select tests.ok(:'bal'::numeric = 7, 'stock out: balance 7');
select (public.record_stock_movement(:'company_a', :'product_a', :'warehouse_a', 'adjustment', -0.5)).balance_after as bal \gset
select tests.ok(:'bal'::numeric = 6.5, 'adjustment: balance 6.5');

select tests.throws(format($$select public.record_stock_movement(%L, %L, %L, 'out', 100)$$, :'company_a', :'product_a', :'warehouse_a'),
  'insufficient stock', 'negative stock prevented');
select tests.throws(format($$select public.record_stock_movement(%L, %L, %L, 'in', -5)$$, :'company_a', :'product_a', :'warehouse_a'),
  '22023', 'stock in requires positive quantity');
select tests.throws(format($$select public.record_stock_movement(%L, %L, %L, 'transfer_in', 5)$$, :'company_a', :'product_a', :'warehouse_a'),
  '22023', 'transfer types not allowed via record_stock_movement');
select tests.throws(format($$select public.record_stock_movement(%L, %L, %L, 'in', 5)$$, :'company_a', :'product_a', :'warehouse_b'),
  'warehouse not found', 'foreign warehouse rejected');
select tests.throws(format($$select public.record_stock_movement(%L, %L, %L, 'in', 5)$$, :'company_b', :'product_a', :'warehouse_b'),
  '42501', 'cannot move stock in foreign company');

select public.transfer_stock(:'company_a', :'product_a', :'warehouse_a', :'warehouse_a2', 2.5, 'To Prizren') as transfer_group \gset
select tests.ok((select quantity = 4 from public.stock_levels where product_id = :'product_a' and warehouse_id = :'warehouse_a'),
  'transfer: source decreased');
select tests.ok((select quantity = 2.5 from public.stock_levels where product_id = :'product_a' and warehouse_id = :'warehouse_a2'),
  'transfer: destination increased');
select tests.ok(tests.count_of(format('select 1 from public.stock_movements where transfer_group_id = %L', :'transfer_group')) = 2,
  'transfer writes two linked movements');
select tests.throws(format($$select public.transfer_stock(%L, %L, %L, %L, 1)$$, :'company_a', :'product_a', :'warehouse_a', :'warehouse_a'),
  '22023', 'transfer to same warehouse rejected');
select tests.throws(format($$select public.transfer_stock(%L, %L, %L, %L, 50)$$, :'company_a', :'product_a', :'warehouse_a', :'warehouse_a2'),
  'insufficient stock', 'transfer cannot overdraw source');
select tests.ok((select quantity = 4 from public.stock_levels where product_id = :'product_a' and warehouse_id = :'warehouse_a'),
  'failed transfer rolled back');

select tests.throws(format($$update public.stock_levels set quantity = 999 where product_id = %L$$, :'product_a'),
  '42501', 'stock_levels not directly writable');
select tests.throws(format($$insert into public.stock_movements (company_id, product_id, warehouse_id, movement_type, quantity, balance_after)
  values (%L, %L, %L, 'in', 1, 1)$$, :'company_a', :'product_a', :'warehouse_a'), '42501', 'stock_movements not directly insertable');
select tests.throws($$select public.apply_stock_movement(null, null, null, 'in', 1)$$, '42501', 'internal apply_stock_movement not callable');
select tests.throws($$select public.next_document_number(null, 'sales_order')$$, '42501', 'internal next_document_number not callable');
reset role;

select tests.throws(format($$update public.stock_movements set quantity = 1 where product_id = %L$$, :'product_a'),
  'append-only', 'ledger is append-only even for privileged roles');

-- ---------------------------------------------------------------------------
-- Role-based access within company A.
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000000a4'); -- employee
set role authenticated;
select tests.ok(tests.count_of('select 1 from public.products') = 1, 'employee can view products');
select tests.throws(format($$insert into public.products (company_id, sku, name) values (%L, 'E1', 'E')$$, :'company_a'),
  '42501', 'employee cannot create products');
select tests.throws(format($$select public.record_stock_movement(%L, %L, %L, 'in', 1)$$, :'company_a', :'product_a', :'warehouse_a'),
  '42501', 'employee cannot adjust stock');
select tests.ok(tests.count_of('select 1 from public.expenses') = 0 and not public.has_permission(:'company_a', 'expenses.view'),
  'employee has no expenses access');
select tests.ok(tests.count_of('select 1 from public.company_members') = 1, 'employee sees only own membership');
select tests.ok(tests.count_of('select 1 from public.activity_logs where action = ''company.created''') = 0,
  'employee cannot read company activity log');
insert into public.customers (company_id, name) values (:'company_a', 'Klient Test');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000000a3'); -- manager
set role authenticated;
select tests.ok(tests.affected(format($$update public.products set sale_price = 4.80 where id = %L$$, :'product_a')) = 1,
  'manager can update products');
select tests.throws(format($$update public.products set deleted_at = now() where id = %L$$, :'product_a'),
  'products.delete', 'manager cannot soft-delete products');
select tests.ok(tests.affected(format($$update public.companies set name = 'Renamed' where id = %L$$, :'company_a')) = 0,
  'manager cannot edit company settings');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000000a2'); -- admin
set role authenticated;
select tests.ok(not public.has_permission(:'company_a', 'billing.manage') and public.has_permission(:'company_a', 'employees.manage'),
  'admin lacks billing.manage only');
select tests.throws(format($$update public.company_members set role_id = (select id from public.roles where key = 'owner')
  where company_id = %L and user_id = '00000000-0000-0000-0000-0000000000a3'$$, :'company_a'),
  'only owners', 'admin cannot grant owner role');
select tests.throws(format($$update public.company_members set status = 'suspended'
  where company_id = %L and user_id = '00000000-0000-0000-0000-0000000000a1'$$, :'company_a'),
  'only owners', 'admin cannot suspend the owner');
select tests.throws(format($$update public.company_members set role_id = (select id from public.roles where key = 'owner')
  where company_id = %L and user_id = '00000000-0000-0000-0000-0000000000a2'$$, :'company_a'),
  'own role', 'admin cannot change own role');
select tests.throws(format($$insert into public.company_members (company_id, user_id, role_id, status)
  select %L, '00000000-0000-0000-0000-0000000000a5', id, 'active' from public.roles where key = 'employee'$$, :'company_a'),
  '42501', 'new members must start as invited');
insert into public.company_members (company_id, user_id, role_id, status)
select :'company_a', '00000000-0000-0000-0000-0000000000a5', id, 'invited' from public.roles where key = 'employee';
select tests.ok(tests.affected(format($$update public.company_members set role_id = (select id from public.roles where key = 'manager')
  where company_id = %L and user_id = '00000000-0000-0000-0000-0000000000a4'$$, :'company_a')) = 1,
  'admin can change an employee role');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000000a1'); -- owner
set role authenticated;
select tests.throws(format($$update public.company_members set role_id = (select id from public.roles where key = 'admin')
  where company_id = %L and user_id = '00000000-0000-0000-0000-0000000000a1'$$, :'company_a'),
  'own role', 'sole owner cannot demote themselves');
select tests.throws(format($$update public.companies set status = 'suspended' where id = %L$$, :'company_a'),
  'platform-managed', 'owner cannot change company status');
select tests.ok(tests.affected(format($$update public.companies set city = 'Pejë' where id = %L$$, :'company_a')) = 1,
  'owner can edit company profile');
select tests.ok(tests.affected(format($$update public.products set deleted_at = now() where id = %L$$, :'product_a')) = 1,
  'owner can soft-delete products');
select tests.throws($$update public.profiles set email = 'x@y.z' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', 'profile email column not user-writable');
select tests.ok(tests.affected($$update public.profiles set full_name = 'Arta K.' where id = '00000000-0000-0000-0000-0000000000a1'$$) = 1,
  'user can edit own profile name');
select tests.ok(tests.affected($$update public.profiles set full_name = 'x' where id = '00000000-0000-0000-0000-0000000000b1'$$) = 0,
  'user cannot edit another profile');
select tests.ok(tests.count_of('select 1 from public.profiles') = 5, 'profiles visible: self + co-members only');
select tests.throws($$insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1')$$,
  '42501', 'cannot self-promote to super admin');
select tests.throws(format($$insert into public.subscriptions (company_id, plan_id, status, price)
  select %L, id, 'active', 0 from public.subscription_plans limit 1$$, :'company_a'), '42501', 'subscriptions not tenant-writable');
select tests.ok(tests.affected($$update public.subscription_plans set price_monthly = 0$$) = 0, 'plans not tenant-writable');

-- Line items editable only while the order is a draft.
insert into public.sales_orders (company_id, order_number, warehouse_id) values (:'company_a', 'SO-TEST-1', :'warehouse_a')
returning id as order_a \gset
insert into public.sales_order_items (company_id, sales_order_id, product_id, quantity, unit_price, line_subtotal, line_total)
select :'company_a', :'order_a', id, 1, 4.5, 4.5, 4.5 from public.products where sku = 'KAF-001';
update public.sales_orders set status = 'confirmed' where id = :'order_a';
select tests.throws(format($$insert into public.sales_order_items (company_id, sales_order_id, product_id, quantity, unit_price, line_subtotal, line_total)
  select %L, %L, id, 1, 4.5, 4.5, 4.5 from public.products where sku = 'KAF-001'$$, :'company_a', :'order_a'),
  '42501', 'cannot add items to a confirmed order');
select tests.throws(format($$insert into public.sales_orders (company_id, order_number, warehouse_id, subtotal, total) values (%L, 'SO-BAD', %L, 10, 5)$$,
  :'company_a', :'warehouse_a'), '23514', 'order total must equal subtotal - discount + tax');

-- Login activity log: one row per active company.
select public.log_login('203.0.113.7', 'vitest') as login_rows \gset
select tests.ok(:'login_rows'::int = 1, 'log_login writes one row for one company');
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where company_id = %L and action = 'auth.login'
  and ip_address = '203.0.113.7'$$, :'company_a')) = 1, 'login row visible to owner with IP');
select tests.throws(format($$select public.log_activity(%L, 'x.y')$$, :'company_b'), '42501', 'cannot log into foreign company');
select tests.throws($$insert into public.activity_logs (action) values ('a.b')$$, '42501', 'activity_logs not directly insertable');

-- Storage paths are tenant-scoped by first folder.
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('receipts', %L)$$, :'company_b' || '/r.pdf'),
  '42501', 'cannot upload receipt into foreign company folder');
insert into storage.objects (bucket_id, name) values ('receipts', :'company_a' || '/exp/r.pdf');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('receipts', 'not-a-uuid/r.pdf')$$,
  '42501', 'malformed storage path rejected');
reset role;

-- ---------------------------------------------------------------------------
-- Anonymous access.
-- ---------------------------------------------------------------------------
select tests.as_anon();
set role anon;
select tests.ok(tests.count_of('select 1 from public.subscription_plans') = 3, 'anon can list public plans');
select tests.throws('select 1 from public.companies', '42501', 'anon cannot read companies');
select tests.throws('select 1 from public.products', '42501', 'anon cannot read products');
reset role;

-- ---------------------------------------------------------------------------
-- Suspension and super admin.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', false);
update public.companies set status = 'suspended' where id = :'company_b';
select tests.as_user('00000000-0000-0000-0000-0000000000b1');
set role authenticated;
select tests.ok(not public.is_member(:'company_b') and public.is_member(:'company_b2'), 'suspended company loses access');
reset role;

insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000c1');
select tests.as_user('00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select tests.ok(public.is_super_admin(), 'is_super_admin true for platform admin');
select tests.ok(tests.count_of('select 1 from public.companies') = 3, 'super admin sees all companies');
select tests.ok(tests.count_of('select 1 from public.products') = 0, 'super admin does not bypass tenant data RLS');
reset role;

\echo 'ALL DATABASE TESTS PASSED'
