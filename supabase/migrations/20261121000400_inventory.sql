-- Warehouses, product catalog, per-warehouse stock levels and the immutable stock ledger.
-- Parent tables expose unique (id, company_id) so children can use composite foreign keys
-- that make cross-tenant references impossible.

create table public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  code       text not null check (code ~ '^[A-Za-z0-9_-]{1,20}$'),
  address    text check (address is null or char_length(address) <= 300),
  city       text check (city is null or char_length(city) <= 100),
  is_default boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint warehouses_id_company_unique unique (id, company_id)
);

create unique index warehouses_company_code_unique
  on public.warehouses (company_id, lower(code)) where deleted_at is null;
create unique index warehouses_one_default_per_company
  on public.warehouses (company_id) where is_default and deleted_at is null;
create trigger warehouses_set_updated_at before update on public.warehouses
  for each row execute function public.set_updated_at();

create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  parent_id   uuid,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint product_categories_id_company_unique unique (id, company_id),
  constraint product_categories_parent_fk foreign key (parent_id, company_id)
    references public.product_categories (id, company_id),
  constraint product_categories_not_own_parent check (parent_id is null or parent_id <> id)
);

create unique index product_categories_company_name_unique
  on public.product_categories (company_id, lower(name)) where deleted_at is null;
create index product_categories_parent_idx on public.product_categories (parent_id);
create trigger product_categories_set_updated_at before update on public.product_categories
  for each row execute function public.set_updated_at();

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  category_id     uuid,
  sku             text not null check (char_length(btrim(sku)) between 1 and 64),
  barcode         text check (barcode is null or char_length(barcode) <= 64),
  name            text not null check (char_length(btrim(name)) between 1 and 200),
  description     text,
  product_type    text not null default 'goods' check (product_type in ('goods', 'service')),
  unit            text not null default 'pcs' check (char_length(unit) between 1 and 16),
  purchase_price  numeric(14, 2) not null default 0 check (purchase_price >= 0),
  sale_price      numeric(14, 2) not null default 0 check (sale_price >= 0),
  vat_rate        numeric(5, 2) not null default 18 check (vat_rate between 0 and 100),
  min_stock       numeric(14, 3) not null default 0 check (min_stock >= 0),
  track_inventory boolean not null default true,
  is_active       boolean not null default true,
  image_path      text,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint products_id_company_unique unique (id, company_id),
  constraint products_category_fk foreign key (category_id, company_id)
    references public.product_categories (id, company_id),
  constraint products_service_no_stock check (product_type = 'goods' or not track_inventory)
);

create unique index products_company_sku_unique
  on public.products (company_id, lower(sku)) where deleted_at is null;
create unique index products_company_barcode_unique
  on public.products (company_id, barcode) where barcode is not null and deleted_at is null;
create index products_company_name_idx on public.products (company_id, lower(name));
create index products_category_idx on public.products (category_id);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Current quantity per product and warehouse. Written only by the stock movement functions.
create table public.stock_levels (
  company_id   uuid not null references public.companies (id) on delete cascade,
  product_id   uuid not null,
  warehouse_id uuid not null,
  quantity     numeric(14, 3) not null default 0 check (quantity >= 0),
  updated_at   timestamptz not null default now(),
  primary key (product_id, warehouse_id),
  constraint stock_levels_product_fk foreign key (product_id, company_id)
    references public.products (id, company_id) on delete cascade,
  constraint stock_levels_warehouse_fk foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id) on delete cascade
);

create index stock_levels_company_warehouse_idx on public.stock_levels (company_id, warehouse_id);

-- Append-only ledger. `quantity` is the signed change; `balance_after` is the warehouse
-- quantity after this movement was applied.
create table public.stock_movements (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  product_id        uuid not null,
  warehouse_id      uuid not null,
  movement_type     text not null check (movement_type in (
    'in', 'out', 'adjustment', 'transfer_in', 'transfer_out',
    'sale', 'sale_return', 'purchase', 'purchase_return'
  )),
  quantity          numeric(14, 3) not null check (quantity <> 0),
  balance_after     numeric(14, 3) not null check (balance_after >= 0),
  unit_cost         numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  reference_type    text check (reference_type in ('manual', 'transfer', 'sales_order', 'purchase_order', 'opening')),
  reference_id      uuid,
  transfer_group_id uuid,
  note              text check (note is null or char_length(note) <= 500),
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint stock_movements_product_fk foreign key (product_id, company_id)
    references public.products (id, company_id) on delete cascade,
  constraint stock_movements_warehouse_fk foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id) on delete cascade,
  constraint stock_movements_sign check (
    (movement_type in ('in', 'transfer_in', 'purchase', 'sale_return') and quantity > 0)
    or (movement_type in ('out', 'transfer_out', 'sale', 'purchase_return') and quantity < 0)
    or movement_type = 'adjustment'
  ),
  constraint stock_movements_transfer_shape check (
    (movement_type in ('transfer_in', 'transfer_out')) = (transfer_group_id is not null)
  )
);

create index stock_movements_company_product_idx on public.stock_movements (company_id, product_id, created_at desc);
create index stock_movements_company_warehouse_idx on public.stock_movements (company_id, warehouse_id, created_at desc);
create index stock_movements_company_created_idx on public.stock_movements (company_id, created_at desc);
create index stock_movements_reference_idx on public.stock_movements (reference_type, reference_id) where reference_id is not null;
create index stock_movements_transfer_group_idx on public.stock_movements (transfer_group_id) where transfer_group_id is not null;

create or replace function public.prevent_stock_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'stock_movements is append-only' using errcode = '42501';
end;
$$;

-- Deletes are blocked by privileges instead (only a service-role company purge may cascade).
create trigger stock_movements_append_only before update on public.stock_movements
  for each row execute function public.prevent_stock_movement_mutation();
