-- Phase 2: catalog/inventory guards, stock read models, dashboard and report functions,
-- product images, and audit entries for stock operations.

-- ---------------------------------------------------------------------------
-- Home warehouse per product (pre-selected for stock operations).
-- ---------------------------------------------------------------------------
alter table public.products add column default_warehouse_id uuid;
alter table public.products add constraint products_default_warehouse_fk
  foreign key (default_warehouse_id, company_id) references public.warehouses (id, company_id);
create index products_default_warehouse_idx on public.products (default_warehouse_id)
  where default_warehouse_id is not null;

-- ---------------------------------------------------------------------------
-- Guards (SECURITY DEFINER so they see stock even when the caller lacks inventory.view).
-- Trigger names sort after *_tenant_guard so permission errors are reported first.
-- ---------------------------------------------------------------------------
create or replace function public.products_stock_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if ((old.deleted_at is null and new.deleted_at is not null)
      or (old.track_inventory and not new.track_inventory))
     and exists (select 1 from public.stock_levels sl where sl.product_id = new.id and sl.quantity > 0) then
    raise exception 'product still has stock' using errcode = 'P0001', hint = 'product_has_stock';
  end if;
  return new;
end;
$$;

create trigger products_validate_stock before update on public.products
  for each row execute function public.products_stock_guard();

create or replace function public.warehouses_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retiring boolean;
begin
  v_retiring := (old.deleted_at is null and new.deleted_at is not null) or (old.is_active and not new.is_active);
  if v_retiring and old.is_default then
    raise exception 'the default warehouse cannot be removed' using errcode = 'P0001', hint = 'warehouse_is_default';
  end if;
  if v_retiring and exists (
    select 1 from public.stock_levels sl where sl.warehouse_id = new.id and sl.quantity > 0
  ) then
    raise exception 'warehouse still has stock' using errcode = 'P0001', hint = 'warehouse_has_stock';
  end if;
  if new.is_default and (not new.is_active or new.deleted_at is not null) then
    raise exception 'the default warehouse must be active' using errcode = 'P0001', hint = 'warehouse_is_default';
  end if;
  if v_retiring then
    update public.products set default_warehouse_id = null
     where company_id = new.company_id and default_warehouse_id = new.id;
  end if;
  return new;
end;
$$;

create trigger warehouses_validate_retire before update on public.warehouses
  for each row execute function public.warehouses_guard();

-- Categories are at most two levels deep; a category in use cannot be deleted.
create or replace function public.product_categories_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.product_categories c
               where c.id = new.parent_id and (c.parent_id is not null or c.deleted_at is not null)) then
      raise exception 'parent must be an active top-level category' using errcode = 'P0001', hint = 'category_depth';
    end if;
    if tg_op = 'UPDATE' and exists (
      select 1 from public.product_categories c where c.parent_id = new.id and c.deleted_at is null
    ) then
      raise exception 'a category with subcategories cannot become a subcategory' using errcode = 'P0001', hint = 'category_depth';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null and (
    exists (select 1 from public.products p where p.category_id = new.id and p.deleted_at is null)
    or exists (select 1 from public.product_categories c where c.parent_id = new.id and c.deleted_at is null)
  ) then
    raise exception 'category is in use' using errcode = 'P0001', hint = 'category_in_use';
  end if;
  return new;
end;
$$;

create trigger product_categories_validate before insert or update on public.product_categories
  for each row execute function public.product_categories_guard();

-- Switches the default warehouse in one transaction (the unique index allows only one).
create or replace function public.set_default_warehouse(p_company_id uuid, p_warehouse_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.has_permission(p_company_id, 'warehouses.update') then
    raise exception 'permission denied: warehouses.update' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.warehouses
    where id = p_warehouse_id and company_id = p_company_id and is_active and deleted_at is null
  ) then
    raise exception 'warehouse not found or inactive' using errcode = 'P0002';
  end if;

  update public.warehouses set is_default = false
   where company_id = p_company_id and is_default and id <> p_warehouse_id;
  update public.warehouses set is_default = true
   where company_id = p_company_id and id = p_warehouse_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Product images: private bucket, objects at {company_id}/products/{product_id}/{file}
-- ---------------------------------------------------------------------------
alter table public.products add constraint products_image_path_scoped check (
  image_path is null
  or (image_path like company_id::text || '/products/' || id::text || '/%' and image_path !~ '\.\.')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy product_images_select on storage.objects for select to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[2] = 'products'
         and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'products.view'));

create policy product_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images'
              and (storage.foldername(name))[2] = 'products'
              and public.try_uuid((storage.foldername(name))[3]) is not null
              and (public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'products.update')
                   or public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'products.create')));

create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[2] = 'products'
         and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'products.update'))
  with check (bucket_id = 'product-images'
              and (storage.foldername(name))[2] = 'products'
              and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'products.update'));

create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[2] = 'products'
         and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'products.update'));

-- ---------------------------------------------------------------------------
-- Stock read model. security_invoker: callers see only rows RLS allows them to.
-- needs_reorder: tracked, active product at or below a configured minimum.
-- ---------------------------------------------------------------------------
create view public.product_stock_overview
with (security_invoker = true)
as
select
  p.id,
  p.company_id,
  p.sku,
  p.barcode,
  p.name,
  p.category_id,
  p.product_type,
  p.unit,
  p.purchase_price,
  p.sale_price,
  p.vat_rate,
  p.min_stock,
  p.track_inventory,
  p.is_active,
  p.image_path,
  p.default_warehouse_id,
  p.created_at,
  p.updated_at,
  coalesce(s.quantity, 0)::numeric(14, 3) as quantity,
  round(coalesce(s.quantity, 0) * p.purchase_price, 2)::numeric(16, 2) as stock_value,
  case
    when not p.track_inventory then 'untracked'
    when coalesce(s.quantity, 0) = 0 then 'out'
    when p.min_stock > 0 and s.quantity <= p.min_stock then 'low'
    else 'ok'
  end as stock_status,
  (p.track_inventory and p.is_active and p.min_stock > 0 and coalesce(s.quantity, 0) <= p.min_stock) as needs_reorder
from public.products p
left join lateral (
  select sum(sl.quantity) as quantity
  from public.stock_levels sl
  where sl.product_id = p.id and sl.company_id = p.company_id
) s on true
where p.deleted_at is null;

revoke all on public.product_stock_overview from anon;
grant select on public.product_stock_overview to authenticated;

-- ---------------------------------------------------------------------------
-- Inventory report: one row per tracked product. Quantities/values cover p_warehouse_id when
-- given (all warehouses otherwise); status always reflects the company-wide total.
-- ---------------------------------------------------------------------------
create or replace function public.inventory_report(
  p_company_id   uuid,
  p_warehouse_id uuid default null,
  p_category_id  uuid default null
)
returns table (
  product_id     uuid,
  sku            text,
  name           text,
  category_name  text,
  unit           text,
  is_active      boolean,
  quantity       numeric,
  total_quantity numeric,
  min_stock      numeric,
  purchase_price numeric,
  sale_price     numeric,
  cost_value     numeric,
  retail_value   numeric,
  stock_status   text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.has_permission(p_company_id, 'inventory.view') then
    raise exception 'permission denied: inventory.view' using errcode = '42501';
  end if;

  return query
  select
    p.id, p.sku, p.name, c.name, p.unit, p.is_active,
    coalesce(f.qty, 0)::numeric,
    coalesce(t.qty, 0)::numeric,
    p.min_stock::numeric, p.purchase_price::numeric, p.sale_price::numeric,
    round(coalesce(f.qty, 0) * p.purchase_price, 2)::numeric,
    round(coalesce(f.qty, 0) * p.sale_price, 2)::numeric,
    case
      when coalesce(t.qty, 0) = 0 then 'out'
      when p.min_stock > 0 and t.qty <= p.min_stock then 'low'
      else 'ok'
    end
  from public.products p
  left join public.product_categories c on c.id = p.category_id and c.company_id = p.company_id
  left join lateral (
    select sum(sl.quantity) as qty from public.stock_levels sl
    where sl.product_id = p.id and sl.company_id = p.company_id
  ) t on true
  left join lateral (
    select sum(sl.quantity) as qty from public.stock_levels sl
    where sl.product_id = p.id and sl.company_id = p.company_id
      and (p_warehouse_id is null or sl.warehouse_id = p_warehouse_id)
  ) f on true
  where p.company_id = p_company_id
    and p.deleted_at is null
    and p.track_inventory
    and (p_category_id is null or p.category_id = p_category_id or c.parent_id = p_category_id)
  order by lower(p.name), p.sku;
end;
$$;

-- Per-warehouse totals: distinct products in stock, units and value at cost.
create or replace function public.warehouse_stock_summary(p_company_id uuid)
returns table (warehouse_id uuid, product_count bigint, quantity numeric, stock_value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select sl.warehouse_id,
         count(*) filter (where sl.quantity > 0),
         coalesce(sum(sl.quantity), 0)::numeric,
         round(coalesce(sum(sl.quantity * p.purchase_price), 0), 2)::numeric
  from public.stock_levels sl
  join public.products p on p.id = sl.product_id and p.company_id = sl.company_id and p.deleted_at is null
  where sl.company_id = p_company_id
  group by sl.warehouse_id;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates. security invoker: each figure only covers rows the caller may read
-- (e.g. sales totals are 0 for a member without sales.view; the UI hides those cards).
-- Months are calendar months in Europe/Belgrade.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_company_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Belgrade')::date;
  v_month date := date_trunc('month', (now() at time zone 'Europe/Belgrade'))::date;
  v_result jsonb;
begin
  if not public.has_permission(p_company_id, 'dashboard.view') then
    raise exception 'permission denied: dashboard.view' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'today', v_today,
    'products', (select count(*) from public.products
                 where company_id = p_company_id and deleted_at is null and is_active),
    'customers', (select count(*) from public.customers
                  where company_id = p_company_id and deleted_at is null and is_active),
    'suppliers', (select count(*) from public.suppliers
                  where company_id = p_company_id and deleted_at is null and is_active),
    'stock_value', (select coalesce(sum(o.stock_value), 0) from public.product_stock_overview o
                    where o.company_id = p_company_id),
    'low_stock', (select count(*) from public.product_stock_overview o
                  where o.company_id = p_company_id and o.needs_reorder),
    'sales_month', (select coalesce(sum(total), 0) from public.sales_orders
                    where company_id = p_company_id and deleted_at is null
                      and status in ('confirmed', 'fulfilled') and order_date >= v_month),
    'sales_orders_month', (select count(*) from public.sales_orders
                           where company_id = p_company_id and deleted_at is null
                             and status in ('confirmed', 'fulfilled') and order_date >= v_month),
    'purchases_month', (select coalesce(sum(total), 0) from public.purchase_orders
                        where company_id = p_company_id and deleted_at is null
                          and status in ('ordered', 'partially_received', 'received') and order_date >= v_month),
    'expenses_month', (select coalesce(sum(amount), 0) from public.expenses
                       where company_id = p_company_id and deleted_at is null and expense_date >= v_month),
    'pending_sales', (select count(*) from public.sales_orders
                      where company_id = p_company_id and deleted_at is null and status in ('draft', 'confirmed')),
    'pending_purchases', (select count(*) from public.purchase_orders
                          where company_id = p_company_id and deleted_at is null
                            and status in ('draft', 'ordered', 'partially_received')),
    'monthly', (
      select jsonb_agg(jsonb_build_object(
               'month', to_char(m.month, 'YYYY-MM'),
               'sales', coalesce(s.total, 0),
               'purchases', coalesce(pu.total, 0))
             order by m.month)
      from generate_series(v_month - interval '11 months', v_month, interval '1 month') as m(month)
      left join lateral (
        select sum(so.total) as total from public.sales_orders so
        where so.company_id = p_company_id and so.deleted_at is null
          and so.status in ('confirmed', 'fulfilled')
          and so.order_date >= m.month::date and so.order_date < (m.month + interval '1 month')::date
      ) s on true
      left join lateral (
        select sum(po.total) as total from public.purchase_orders po
        where po.company_id = p_company_id and po.deleted_at is null
          and po.status in ('ordered', 'partially_received', 'received')
          and po.order_date >= m.month::date and po.order_date < (m.month + interval '1 month')::date
      ) pu on true
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stock RPCs, re-declared to write an audit entry in the same transaction.
-- ---------------------------------------------------------------------------
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
  v_row public.stock_movements;
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
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'note too long' using errcode = '22023';
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

  v_row := public.apply_stock_movement(
    p_company_id, p_product_id, p_warehouse_id, p_movement_type, v_delta,
    p_unit_cost, 'manual', null, null, p_note
  );

  perform public.log_activity(
    p_company_id,
    case p_movement_type when 'in' then 'inventory.stock_in'
                         when 'out' then 'inventory.stock_out'
                         else 'inventory.adjustment' end,
    'product', p_product_id,
    jsonb_build_object('movement_id', v_row.id, 'warehouse_id', p_warehouse_id,
                       'quantity', v_row.quantity, 'balance_after', v_row.balance_after));

  return v_row;
end;
$$;

-- Stock count: sets the warehouse quantity to what was counted. The correction is computed
-- under the row lock, so concurrent movements cannot make the result drift.
create or replace function public.record_stock_count(
  p_company_id   uuid,
  p_product_id   uuid,
  p_warehouse_id uuid,
  p_counted      numeric,
  p_note         text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current numeric(14, 3);
  v_row public.stock_movements;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.has_permission(p_company_id, 'inventory.adjust') then
    raise exception 'permission denied: inventory.adjust' using errcode = '42501';
  end if;
  if p_counted is null or p_counted < 0 then
    raise exception 'counted quantity cannot be negative' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'note too long' using errcode = '22023';
  end if;

  insert into public.stock_levels (company_id, product_id, warehouse_id, quantity)
  select p_company_id, p_product_id, w.id, 0
  from public.warehouses w
  join public.products p on p.id = p_product_id and p.company_id = p_company_id
  where w.company_id = p_company_id and w.id = p_warehouse_id
  on conflict (product_id, warehouse_id) do nothing;

  select quantity into v_current
  from public.stock_levels
  where product_id = p_product_id and warehouse_id = p_warehouse_id and company_id = p_company_id
  for update;

  if v_current is null then
    raise exception 'product or warehouse not found' using errcode = 'P0002';
  end if;
  if round(p_counted, 3) = v_current then
    raise exception 'counted quantity equals current stock' using errcode = 'P0001', hint = 'no_change';
  end if;

  v_row := public.apply_stock_movement(
    p_company_id, p_product_id, p_warehouse_id, 'adjustment', round(p_counted, 3) - v_current,
    null, 'manual', null, null, p_note
  );

  perform public.log_activity(
    p_company_id, 'inventory.adjustment', 'product', p_product_id,
    jsonb_build_object('movement_id', v_row.id, 'warehouse_id', p_warehouse_id,
                       'quantity', v_row.quantity, 'balance_after', v_row.balance_after,
                       'counted', round(p_counted, 3)));

  return v_row;
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
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'note too long' using errcode = '22023';
  end if;

  -- Lock both stock rows in a stable order to avoid deadlocks between opposite transfers.
  insert into public.stock_levels (company_id, product_id, warehouse_id, quantity)
  select p_company_id, p_product_id, w.id, 0
  from public.warehouses w
  join public.products p on p.id = p_product_id and p.company_id = p_company_id
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

  perform public.log_activity(
    p_company_id, 'inventory.transfer', 'product', p_product_id,
    jsonb_build_object('transfer_group_id', v_group, 'from_warehouse_id', p_from_warehouse_id,
                       'to_warehouse_id', p_to_warehouse_id, 'quantity', round(p_quantity, 3)));

  return v_group;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function
  public.products_stock_guard(),
  public.warehouses_guard(),
  public.product_categories_guard()
from public, anon, authenticated;

revoke execute on function
  public.set_default_warehouse(uuid, uuid),
  public.inventory_report(uuid, uuid, uuid),
  public.warehouse_stock_summary(uuid),
  public.dashboard_summary(uuid),
  public.record_stock_movement(uuid, uuid, uuid, text, numeric, numeric, text),
  public.record_stock_count(uuid, uuid, uuid, numeric, text),
  public.transfer_stock(uuid, uuid, uuid, uuid, numeric, text)
from public, anon;

grant execute on function
  public.set_default_warehouse(uuid, uuid),
  public.inventory_report(uuid, uuid, uuid),
  public.warehouse_stock_summary(uuid),
  public.dashboard_summary(uuid),
  public.record_stock_movement(uuid, uuid, uuid, text, numeric, numeric, text),
  public.record_stock_count(uuid, uuid, uuid, numeric, text),
  public.transfer_stock(uuid, uuid, uuid, uuid, numeric, text)
to authenticated;
