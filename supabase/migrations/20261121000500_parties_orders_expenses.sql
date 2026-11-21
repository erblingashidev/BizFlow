-- Customers, suppliers, sales/purchase orders with line items, expenses and per-company
-- document numbering.

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  customer_type   text not null default 'business' check (customer_type in ('individual', 'business')),
  name            text not null check (char_length(btrim(name)) between 1 and 200),
  contact_person  text check (contact_person is null or char_length(contact_person) <= 120),
  business_number text check (business_number is null or char_length(business_number) <= 32),
  vat_number      text check (vat_number is null or char_length(vat_number) <= 32),
  email           text check (email is null or char_length(email) <= 254),
  phone           text check (phone is null or char_length(phone) <= 32),
  address         text check (address is null or char_length(address) <= 300),
  city            text check (city is null or char_length(city) <= 100),
  country_code    char(2) not null default 'XK' check (country_code ~ '^[A-Z]{2}$'),
  notes           text,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint customers_id_company_unique unique (id, company_id)
);

create index customers_company_name_idx on public.customers (company_id, lower(name));
create unique index customers_company_business_number_unique
  on public.customers (company_id, business_number) where business_number is not null and deleted_at is null;
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create table public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 200),
  contact_person  text check (contact_person is null or char_length(contact_person) <= 120),
  business_number text check (business_number is null or char_length(business_number) <= 32),
  vat_number      text check (vat_number is null or char_length(vat_number) <= 32),
  email           text check (email is null or char_length(email) <= 254),
  phone           text check (phone is null or char_length(phone) <= 32),
  address         text check (address is null or char_length(address) <= 300),
  city            text check (city is null or char_length(city) <= 100),
  country_code    char(2) not null default 'XK' check (country_code ~ '^[A-Z]{2}$'),
  notes           text,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint suppliers_id_company_unique unique (id, company_id)
);

create index suppliers_company_name_idx on public.suppliers (company_id, lower(name));
create unique index suppliers_company_business_number_unique
  on public.suppliers (company_id, business_number) where business_number is not null and deleted_at is null;
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

create table public.document_sequences (
  company_id uuid not null references public.companies (id) on delete cascade,
  doc_type   text not null check (doc_type in ('sales_order', 'purchase_order')),
  prefix     text not null check (prefix ~ '^[A-Z]{1,6}$'),
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now(),
  primary key (company_id, doc_type)
);

create table public.sales_orders (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  order_number   text not null check (char_length(order_number) between 1 and 40),
  customer_id    uuid,
  warehouse_id   uuid not null,
  status         text not null default 'draft' check (status in ('draft', 'confirmed', 'fulfilled', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  order_date     date not null default ((now() at time zone 'Europe/Belgrade')::date),
  due_date       date,
  currency       char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  subtotal       numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount_total numeric(14, 2) not null default 0 check (discount_total >= 0),
  tax_total      numeric(14, 2) not null default 0 check (tax_total >= 0),
  total          numeric(14, 2) not null default 0 check (total >= 0),
  amount_paid    numeric(14, 2) not null default 0 check (amount_paid >= 0),
  notes          text,
  created_by     uuid references public.profiles (id) on delete set null,
  confirmed_at   timestamptz,
  fulfilled_at   timestamptz,
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint sales_orders_id_company_unique unique (id, company_id),
  constraint sales_orders_number_unique unique (company_id, order_number),
  constraint sales_orders_customer_fk foreign key (customer_id, company_id)
    references public.customers (id, company_id),
  constraint sales_orders_warehouse_fk foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id),
  constraint sales_orders_total_matches check (total = subtotal - discount_total + tax_total),
  constraint sales_orders_paid_not_above_total check (amount_paid <= total),
  constraint sales_orders_due_after_order check (due_date is null or due_date >= order_date)
);

create index sales_orders_company_date_idx on public.sales_orders (company_id, order_date desc);
create index sales_orders_company_status_idx on public.sales_orders (company_id, status);
create index sales_orders_customer_idx on public.sales_orders (customer_id);
create index sales_orders_warehouse_idx on public.sales_orders (warehouse_id);
create trigger sales_orders_set_updated_at before update on public.sales_orders
  for each row execute function public.set_updated_at();

create table public.sales_order_items (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  sales_order_id   uuid not null,
  product_id       uuid not null,
  description      text check (description is null or char_length(description) <= 300),
  quantity         numeric(14, 3) not null check (quantity > 0),
  unit_price       numeric(14, 2) not null check (unit_price >= 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100),
  vat_rate         numeric(5, 2) not null default 18 check (vat_rate between 0 and 100),
  line_subtotal    numeric(14, 2) not null check (line_subtotal >= 0),
  line_discount    numeric(14, 2) not null default 0 check (line_discount >= 0),
  line_tax         numeric(14, 2) not null default 0 check (line_tax >= 0),
  line_total       numeric(14, 2) not null check (line_total >= 0),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint sales_order_items_order_fk foreign key (sales_order_id, company_id)
    references public.sales_orders (id, company_id) on delete cascade,
  constraint sales_order_items_product_fk foreign key (product_id, company_id)
    references public.products (id, company_id),
  constraint sales_order_items_total_matches check (line_total = line_subtotal - line_discount + line_tax)
);

create index sales_order_items_order_idx on public.sales_order_items (sales_order_id, sort_order);
create index sales_order_items_product_idx on public.sales_order_items (product_id);
create trigger sales_order_items_set_updated_at before update on public.sales_order_items
  for each row execute function public.set_updated_at();

create table public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  order_number  text not null check (char_length(order_number) between 1 and 40),
  supplier_id   uuid not null,
  warehouse_id  uuid not null,
  status        text not null default 'draft' check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  order_date    date not null default ((now() at time zone 'Europe/Belgrade')::date),
  expected_date date,
  currency      char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  subtotal      numeric(14, 2) not null default 0 check (subtotal >= 0),
  tax_total     numeric(14, 2) not null default 0 check (tax_total >= 0),
  total         numeric(14, 2) not null default 0 check (total >= 0),
  notes         text,
  created_by    uuid references public.profiles (id) on delete set null,
  ordered_at    timestamptz,
  received_at   timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint purchase_orders_id_company_unique unique (id, company_id),
  constraint purchase_orders_number_unique unique (company_id, order_number),
  constraint purchase_orders_supplier_fk foreign key (supplier_id, company_id)
    references public.suppliers (id, company_id),
  constraint purchase_orders_warehouse_fk foreign key (warehouse_id, company_id)
    references public.warehouses (id, company_id),
  constraint purchase_orders_total_matches check (total = subtotal + tax_total),
  constraint purchase_orders_expected_after_order check (expected_date is null or expected_date >= order_date)
);

create index purchase_orders_company_date_idx on public.purchase_orders (company_id, order_date desc);
create index purchase_orders_company_status_idx on public.purchase_orders (company_id, status);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_warehouse_idx on public.purchase_orders (warehouse_id);
create trigger purchase_orders_set_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();

create table public.purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  purchase_order_id uuid not null,
  product_id        uuid not null,
  description       text check (description is null or char_length(description) <= 300),
  quantity          numeric(14, 3) not null check (quantity > 0),
  quantity_received numeric(14, 3) not null default 0 check (quantity_received >= 0),
  unit_cost         numeric(14, 2) not null check (unit_cost >= 0),
  vat_rate          numeric(5, 2) not null default 18 check (vat_rate between 0 and 100),
  line_subtotal     numeric(14, 2) not null check (line_subtotal >= 0),
  line_tax          numeric(14, 2) not null default 0 check (line_tax >= 0),
  line_total        numeric(14, 2) not null check (line_total >= 0),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint purchase_order_items_order_fk foreign key (purchase_order_id, company_id)
    references public.purchase_orders (id, company_id) on delete cascade,
  constraint purchase_order_items_product_fk foreign key (product_id, company_id)
    references public.products (id, company_id),
  constraint purchase_order_items_received_not_above check (quantity_received <= quantity),
  constraint purchase_order_items_total_matches check (line_total = line_subtotal + line_tax)
);

create index purchase_order_items_order_idx on public.purchase_order_items (purchase_order_id, sort_order);
create index purchase_order_items_product_idx on public.purchase_order_items (product_id);
create trigger purchase_order_items_set_updated_at before update on public.purchase_order_items
  for each row execute function public.set_updated_at();

create table public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  color      text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expense_categories_id_company_unique unique (id, company_id)
);

create unique index expense_categories_company_name_unique
  on public.expense_categories (company_id, lower(name)) where deleted_at is null;
create trigger expense_categories_set_updated_at before update on public.expense_categories
  for each row execute function public.set_updated_at();

create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  category_id    uuid,
  supplier_id    uuid,
  expense_date   date not null default ((now() at time zone 'Europe/Belgrade')::date),
  description    text not null check (char_length(btrim(description)) between 1 and 300),
  -- Gross amount; vat_amount is the VAT portion included in it.
  amount         numeric(14, 2) not null check (amount > 0),
  vat_amount     numeric(14, 2) not null default 0 check (vat_amount >= 0),
  currency       char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank_transfer', 'card', 'other')),
  reference      text check (reference is null or char_length(reference) <= 64),
  receipt_path   text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint expenses_category_fk foreign key (category_id, company_id)
    references public.expense_categories (id, company_id),
  constraint expenses_supplier_fk foreign key (supplier_id, company_id)
    references public.suppliers (id, company_id),
  constraint expenses_vat_within_amount check (vat_amount <= amount)
);

create index expenses_company_date_idx on public.expenses (company_id, expense_date desc);
create index expenses_category_idx on public.expenses (category_id);
create index expenses_supplier_idx on public.expenses (supplier_id);
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

create table public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type text check (entity_type is null or char_length(entity_type) <= 64),
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  ip_address  inet,
  user_agent  text check (user_agent is null or char_length(user_agent) <= 512),
  created_at  timestamptz not null default now()
);

create index activity_logs_company_created_idx on public.activity_logs (company_id, created_at desc);
create index activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id) where entity_id is not null;
