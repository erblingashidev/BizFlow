-- Phase 2: audit trail integrity, catalog/warehouse guards, product image paths, stock
-- read models, inventory report and dashboard aggregates.
-- Runs after rls_and_rpc_tests.sql (reuses its tests.* helpers) on its own companies.

\set ON_ERROR_STOP 1
\set QUIET 1

select set_config('request.jwt.claims', '', false);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002a1', 'owner-p@test.local'),
  ('00000000-0000-0000-0000-0000000002a2', 'manager-p@test.local'),
  ('00000000-0000-0000-0000-0000000002a3', 'employee-p@test.local'),
  ('00000000-0000-0000-0000-0000000002b1', 'owner-q@test.local');

select tests.as_user('00000000-0000-0000-0000-0000000002a1');
set role authenticated;
select public.create_company('Pika Shop', 'starter') as company_p \gset
reset role;
select tests.as_user('00000000-0000-0000-0000-0000000002b1');
set role authenticated;
select public.create_company('Qendra Market', 'starter') as company_q \gset
reset role;

select set_config('request.jwt.claims', '', false);
insert into public.company_members (company_id, user_id, role_id, status)
select :'company_p', u.id, r.id, 'active'
from (values ('00000000-0000-0000-0000-0000000002a2'::uuid, 'manager'),
             ('00000000-0000-0000-0000-0000000002a3'::uuid, 'employee')) as u(id, role_key)
join public.roles r on r.key = u.role_key and r.is_system;

select id as wh_main from public.warehouses where company_id = :'company_p' and is_default \gset
select id as wh_q from public.warehouses where company_id = :'company_q' and is_default \gset

-- ---------------------------------------------------------------------------
-- Audit trail: written by triggers/RPCs with the real caller, never by clients.
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000002a1');
set role authenticated;

insert into public.warehouses (company_id, name, code) values (:'company_p', 'Depo Gjilan', 'GJ')
returning id as wh_second \gset
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where company_id = %L and action = 'warehouse.created'
  and entity_id = %L and user_id = '00000000-0000-0000-0000-0000000002a1' and metadata ->> 'label' = 'Depo Gjilan'$$,
  :'company_p', :'wh_second')) = 1, 'warehouse insert audited with caller and label');

insert into public.product_categories (company_id, name) values (:'company_p', 'Pije') returning id as cat_drinks \gset
insert into public.product_categories (company_id, name, parent_id) values (:'company_p', 'Lëngje', :'cat_drinks')
returning id as cat_juice \gset

insert into public.products (company_id, category_id, sku, name, purchase_price, sale_price, min_stock, created_by)
values (:'company_p', :'cat_juice', 'LNG-1', 'Lëng portokalli 1L', 1.20, 1.90, 5, '00000000-0000-0000-0000-0000000002b1')
returning id as prod_juice \gset
insert into public.products (company_id, category_id, sku, name, purchase_price, sale_price, min_stock)
values (:'company_p', :'cat_drinks', 'UJE-1', 'Ujë 0.5L', 0.20, 0.50, 0)
returning id as prod_water \gset

select tests.ok((select created_by = '00000000-0000-0000-0000-0000000002a1' from public.products where id = :'prod_juice'),
  'created_by forced to the caller, client value ignored');
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where action = 'product.created' and entity_id = %L$$,
  :'prod_juice')) = 1, 'product insert audited');

update public.products set sale_price = 2.10 where id = :'prod_juice';
select tests.ok((select metadata -> 'changed' = '["sale_price"]'::jsonb from public.activity_logs
                 where action = 'product.updated' and entity_id = :'prod_juice'),
  'product update audited with changed columns');
update public.products set name = name where id = :'prod_juice';
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where action = 'product.updated' and entity_id = %L$$,
  :'prod_juice')) = 1, 'no-op update not audited');
update public.products set created_by = '00000000-0000-0000-0000-0000000002b1' where id = :'prod_juice';
select tests.ok((select created_by = '00000000-0000-0000-0000-0000000002a1' from public.products where id = :'prod_juice'),
  'created_by cannot be changed');

update public.products set is_active = false where id = :'prod_water';
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where action = 'product.archived' and entity_id = %L$$,
  :'prod_water')) = 1, 'archive audited');
update public.products set is_active = true where id = :'prod_water';
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where action = 'product.activated' and entity_id = %L$$,
  :'prod_water')) = 1, 'reactivation audited');

select tests.throws(format($$select public.log_activity(%L, 'product.deleted', 'product', %L)$$, :'company_p', :'prod_juice'),
  '42501', 'owner cannot forge entries via log_activity');
select tests.throws(format($$insert into public.activity_logs (company_id, user_id, action) values (%L, '00000000-0000-0000-0000-0000000002a2', 'auth.login')$$,
  :'company_p'), '42501', 'owner cannot insert activity rows');
select tests.throws(format($$update public.activity_logs set action = 'x.y' where company_id = %L$$, :'company_p'),
  '42501', 'activity rows cannot be edited');
select tests.throws(format($$delete from public.activity_logs where company_id = %L$$, :'company_p'),
  '42501', 'activity rows cannot be deleted');
select tests.throws($$select public.audit_row_change()$$, '42501', 'audit trigger function not callable');

-- Stock operations are audited in the same transaction.
select (public.record_stock_movement(:'company_p', :'prod_juice', :'wh_main', 'in', 12, 1.20, 'Furnizim')).id as mv_in \gset
select tests.ok((select metadata ->> 'movement_id' = :'mv_in' and (metadata ->> 'quantity')::numeric = 12
                 from public.activity_logs where action = 'inventory.stock_in' and entity_id = :'prod_juice'),
  'stock in audited with movement id');
select public.record_stock_movement(:'company_p', :'prod_water', :'wh_main', 'in', 100, 0.20) \gset
select public.record_stock_movement(:'company_p', :'prod_juice', :'wh_main', 'out', 2) \gset
select public.record_stock_movement(:'company_p', :'prod_juice', :'wh_main', 'adjustment', -1) \gset
select public.transfer_stock(:'company_p', :'prod_juice', :'wh_main', :'wh_second', 4) as tg \gset
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where company_id = %L and action in
  ('inventory.stock_out', 'inventory.adjustment')$$, :'company_p')) = 2, 'stock out and adjustment audited');
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where action = 'inventory.transfer'
  and metadata ->> 'transfer_group_id' = %L$$, :'tg')) = 1, 'transfer audited once');
select tests.throws(format($$select public.record_stock_movement(%L, %L, %L, 'in', 1, null, %L)$$,
  :'company_p', :'prod_juice', :'wh_main', repeat('x', 501)), '22023', 'movement note length limited');

-- Stock count: water 100 counted as 97 -> adjustment of -3.
select (public.record_stock_count(:'company_p', :'prod_water', :'wh_main', 97, 'Numërim')).quantity as count_delta \gset
select tests.ok(:'count_delta'::numeric = -3
                and (select quantity = 97 from public.stock_levels where product_id = :'prod_water' and warehouse_id = :'wh_main'),
  'stock count sets quantity via a computed adjustment');
select tests.throws(format($$select public.record_stock_count(%L, %L, %L, 97)$$, :'company_p', :'prod_water', :'wh_main'),
  'no_change', 'stock count equal to current is rejected');
select tests.throws(format($$select public.record_stock_count(%L, %L, %L, -1)$$, :'company_p', :'prod_water', :'wh_main'),
  '22023', 'stock count cannot be negative');
select tests.throws(format($$select public.record_stock_count(%L, %L, %L, 5)$$, :'company_p', :'prod_water', :'wh_q'),
  'P0002', 'stock count rejects foreign warehouse');
select public.record_stock_count(:'company_p', :'prod_water', :'wh_main', 100) \gset
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000002a3'); -- employee
set role authenticated;
select tests.throws(format($$select public.record_stock_count(%L, %L, %L, 1)$$, :'company_p', :'prod_water', :'wh_main'),
  '42501', 'employee cannot record stock counts');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000002b1');
set role authenticated;
select tests.ok(tests.count_of(format($$select 1 from public.activity_logs where company_id = %L$$, :'company_p')) = 0,
  'other tenant sees none of the audit trail');
reset role;

select set_config('request.jwt.claims', '', false);
update public.products set sale_price = 2.20 where id = :'prod_juice';
select tests.ok((select user_id is null from public.activity_logs
                 where action = 'product.updated' and entity_id = :'prod_juice' order by created_at desc limit 1),
  'service-side changes audited without a user');

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000002a1');
set role authenticated;

select tests.throws(format($$update public.warehouses set is_active = false where id = %L$$, :'wh_second'),
  'warehouse_has_stock', 'warehouse with stock cannot be deactivated');
select tests.throws(format($$update public.warehouses set deleted_at = now() where id = %L$$, :'wh_second'),
  'warehouse_has_stock', 'warehouse with stock cannot be deleted');
select tests.throws(format($$update public.warehouses set is_active = false where id = %L$$, :'wh_main'),
  'warehouse_is_default', 'default warehouse cannot be deactivated');
select tests.throws(format($$update public.products set track_inventory = false where id = %L$$, :'prod_juice'),
  'product_has_stock', 'stock tracking cannot be disabled while stock exists');

select public.set_default_warehouse(:'company_p', :'wh_second');
select tests.ok((select is_default from public.warehouses where id = :'wh_second')
                and not (select is_default from public.warehouses where id = :'wh_main'),
  'set_default_warehouse switches the default');
select public.set_default_warehouse(:'company_p', :'wh_main');
select tests.throws(format($$select public.set_default_warehouse(%L, %L)$$, :'company_p', :'wh_q'),
  'P0002', 'cannot make a foreign warehouse default');

select tests.throws(format($$update public.products set default_warehouse_id = %L where id = %L$$, :'wh_q', :'prod_water'),
  '23503', 'home warehouse must belong to the same company');
insert into public.warehouses (company_id, name, code) values (:'company_p', 'Pop-up', 'POP') returning id as wh_popup \gset
update public.products set default_warehouse_id = :'wh_popup' where id = :'prod_water';
update public.warehouses set is_active = false where id = :'wh_popup';
select tests.ok((select default_warehouse_id is null from public.products where id = :'prod_water'),
  'retiring a warehouse clears it as home warehouse');

select tests.throws(format($$insert into public.product_categories (company_id, name, parent_id) values (%L, 'Too deep', %L)$$,
  :'company_p', :'cat_juice'), 'category_depth', 'categories limited to two levels');
select tests.throws(format($$update public.product_categories set parent_id = %L where id = %L$$, :'cat_juice', :'cat_drinks'),
  'category_depth', 'category with children cannot become a child');
select tests.throws(format($$update public.product_categories set deleted_at = now() where id = %L$$, :'cat_juice'),
  'category_in_use', 'category with products cannot be deleted');
insert into public.product_categories (company_id, name) values (:'company_p', 'Bosh') returning id as cat_empty \gset
select tests.ok(tests.affected(format($$update public.product_categories set deleted_at = now() where id = %L$$, :'cat_empty')) = 1,
  'unused category can be deleted');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000002a2'); -- manager
set role authenticated;
select tests.throws(format($$select public.set_default_warehouse(%L, %L)$$, :'company_p', :'wh_second'),
  '42501', 'manager cannot change the default warehouse');
select tests.ok(tests.affected(format($$update public.warehouses set name = 'X' where id = %L$$, :'wh_second')) = 0,
  'manager cannot edit warehouses');
reset role;

-- ---------------------------------------------------------------------------
-- Product images: DB paths and storage objects are scoped to company and product.
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000002a1');
set role authenticated;
select tests.throws(format($$update public.products set image_path = %L where id = %L$$,
  :'company_q' || '/products/' || :'prod_juice' || '/a.png', :'prod_juice'), '23514', 'image path must use own company');
select tests.throws(format($$update public.products set image_path = %L where id = %L$$,
  :'company_p' || '/products/' || :'prod_water' || '/a.png', :'prod_juice'), '23514', 'image path must use own product');
select tests.throws(format($$update public.products set image_path = %L where id = %L$$,
  :'company_p' || '/products/' || :'prod_juice' || '/../x.png', :'prod_juice'), '23514', 'image path rejects ..');
select tests.ok(tests.affected(format($$update public.products set image_path = %L where id = %L$$,
  :'company_p' || '/products/' || :'prod_juice' || '/img.webp', :'prod_juice')) = 1, 'scoped image path accepted');

insert into storage.objects (bucket_id, name) values ('product-images', :'company_p' || '/products/' || :'prod_juice' || '/img.webp');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('product-images', %L)$$,
  :'company_q' || '/products/' || :'prod_juice' || '/x.png'), '42501', 'cannot upload image into foreign company');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('product-images', %L)$$,
  :'company_p' || '/other/x.png'), '42501', 'image must live under products/');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('product-images', %L)$$,
  :'company_p' || '/products/not-a-uuid/x.png'), '42501', 'image folder must be a product id');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000002a3'); -- employee: products.view only
set role authenticated;
select tests.ok(tests.count_of($$select 1 from storage.objects where bucket_id = 'product-images'$$) = 1,
  'employee can read product images');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('product-images', %L)$$,
  :'company_p' || '/products/' || :'prod_juice' || '/e.png'), '42501', 'employee cannot upload product images');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000002b1');
set role authenticated;
select tests.ok(tests.count_of($$select 1 from storage.objects where bucket_id = 'product-images'$$) = 0,
  'other tenant cannot read product images');
reset role;

-- ---------------------------------------------------------------------------
-- Read models: stock overview, inventory report, dashboard
-- juice: main 12 - 2 - 1 - 4 = 5, second 4 -> total 9 (min 5, ok). water: 100 (min 0).
-- ---------------------------------------------------------------------------
select tests.as_user('00000000-0000-0000-0000-0000000002a1');
set role authenticated;
select tests.ok((select quantity = 9 and stock_value = 10.80 and stock_status = 'ok' and not needs_reorder
                 from public.product_stock_overview where id = :'prod_juice'),
  'overview sums all warehouses and values at cost');
select public.record_stock_movement(:'company_p', :'prod_juice', :'wh_second', 'out', 4) \gset
select tests.ok((select quantity = 5 and stock_status = 'low' and needs_reorder
                 from public.product_stock_overview where id = :'prod_juice'),
  'at minimum stock the product needs reorder');
select tests.ok((select stock_status = 'ok' and not needs_reorder from public.product_stock_overview where id = :'prod_water'),
  'no minimum configured: no reorder alert');

select tests.ok((select quantity = 0 and total_quantity = 5 and stock_status = 'low'
                 from public.inventory_report(:'company_p', :'wh_second') where product_id = :'prod_juice'),
  'report: warehouse filter scopes quantity, status uses total');
select tests.ok((select count(*) = 2 from public.inventory_report(:'company_p', null, :'cat_drinks')),
  'report: parent category includes subcategories');
select tests.ok((select sum(cost_value) = 26.00 from public.inventory_report(:'company_p')),
  'report: cost value totals');
select tests.ok((select product_count = 2 and quantity = 105 and stock_value = 26.00
                 from public.warehouse_stock_summary(:'company_p') where warehouse_id = :'wh_main'),
  'warehouse summary: products in stock, units and value');
select tests.ok((select count(*) = 0 from public.warehouse_stock_summary(:'company_q')),
  'warehouse summary of foreign company is empty');

insert into public.customers (company_id, name) values (:'company_p', 'Klienti 1') returning id as cust \gset
insert into public.sales_orders (company_id, order_number, customer_id, warehouse_id, status, subtotal, tax_total, total)
values (:'company_p', 'SO-T-1', :'cust', :'wh_main', 'confirmed', 100, 18, 118),
       (:'company_p', 'SO-T-2', :'cust', :'wh_main', 'draft', 50, 9, 59),
       (:'company_p', 'SO-T-3', :'cust', :'wh_main', 'cancelled', 10, 0, 10);
insert into public.suppliers (company_id, name) values (:'company_p', 'Furnitori 1') returning id as supp \gset
insert into public.purchase_orders (company_id, order_number, supplier_id, warehouse_id, status, subtotal, total)
values (:'company_p', 'PO-T-1', :'supp', :'wh_main', 'received', 40, 40);

select public.dashboard_summary(:'company_p') as dash \gset
select tests.ok((:'dash'::jsonb ->> 'sales_month')::numeric = 118
                and (:'dash'::jsonb ->> 'sales_orders_month')::int = 1
                and (:'dash'::jsonb ->> 'pending_sales')::int = 2
                and (:'dash'::jsonb ->> 'purchases_month')::numeric = 40
                and (:'dash'::jsonb ->> 'low_stock')::int = 1
                and (:'dash'::jsonb ->> 'stock_value')::numeric = 26.00
                and (:'dash'::jsonb ->> 'products')::int = 2
                and (:'dash'::jsonb ->> 'customers')::int = 1,
  'dashboard totals');
select tests.ok(jsonb_array_length(:'dash'::jsonb -> 'monthly') = 12
                and ((:'dash'::jsonb -> 'monthly' -> 11 ->> 'sales')::numeric) = 118,
  'dashboard: 12 months, current month last');
select tests.throws(format($$select public.dashboard_summary(%L)$$, :'company_q'), '42501', 'dashboard of foreign company denied');
select tests.throws(format($$select * from public.inventory_report(%L)$$, :'company_q'), '42501', 'report of foreign company denied');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000002a3'); -- employee: no purchases.view
set role authenticated;
select public.dashboard_summary(:'company_p') as dash_e \gset
select tests.ok((:'dash_e'::jsonb ->> 'purchases_month')::numeric = 0 and (:'dash_e'::jsonb ->> 'sales_month')::numeric = 118,
  'dashboard figures respect the caller''s RLS');
reset role;

select tests.as_user('00000000-0000-0000-0000-0000000002b1');
set role authenticated;
select tests.ok(tests.count_of('select 1 from public.product_stock_overview') = 0, 'overview is tenant-isolated');
reset role;

select tests.as_anon();
set role anon;
select tests.throws('select 1 from public.product_stock_overview', '42501', 'anon cannot read stock overview');
select tests.throws(format($$select public.dashboard_summary(%L)$$, :'company_p'), '42501', 'anon cannot call dashboard_summary');
reset role;

\echo 'PHASE 2 DATABASE TESTS PASSED'
