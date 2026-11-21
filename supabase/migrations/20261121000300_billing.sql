-- Subscription plans (data-driven, editable by super admins), company subscriptions,
-- and billing history (invoices + payments).

create table public.subscription_plans (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[a-z][a-z0-9_]{1,49}$'),
  name           text not null check (char_length(name) between 1 and 80),
  description    text,
  price_monthly  numeric(10, 2) not null check (price_monthly >= 0),
  price_yearly   numeric(10, 2) check (price_yearly is null or price_yearly >= 0),
  currency       char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  -- Seats for members other than owners. NULL = unlimited.
  max_employees  integer check (max_employees is null or max_employees >= 0),
  max_warehouses integer check (max_warehouses is null or max_warehouses > 0),
  features       jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  trial_days     integer not null default 14 check (trial_days between 0 and 90),
  is_active      boolean not null default true,
  is_public      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger subscription_plans_set_updated_at before update on public.subscription_plans
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies (id) on delete cascade,
  plan_id                  uuid not null references public.subscription_plans (id),
  status                   text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  billing_interval         text not null default 'month' check (billing_interval in ('month', 'year')),
  -- Price locked at subscription time so plan price edits don't rewrite history.
  price                    numeric(10, 2) not null check (price >= 0),
  currency                 char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  trial_ends_at            timestamptz,
  current_period_start     timestamptz not null default now(),
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  canceled_at              timestamptz,
  ended_at                 timestamptz,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint subscriptions_id_company_unique unique (id, company_id),
  constraint subscriptions_period_order check (current_period_end is null or current_period_end >= current_period_start),
  constraint subscriptions_trial_shape check (status <> 'trialing' or trial_ends_at is not null)
);

-- At most one live subscription per company.
create unique index subscriptions_one_live_per_company
  on public.subscriptions (company_id) where status in ('trialing', 'active', 'past_due');
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
create unique index subscriptions_provider_id_unique
  on public.subscriptions (provider, provider_subscription_id) where provider_subscription_id is not null;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.billing_invoices (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  subscription_id     uuid,
  invoice_number      text not null unique check (char_length(invoice_number) between 1 and 40),
  status              text not null default 'draft' check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  currency            char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  subtotal            numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax_total           numeric(12, 2) not null default 0 check (tax_total >= 0),
  total               numeric(12, 2) not null default 0 check (total >= 0),
  period_start        timestamptz,
  period_end          timestamptz,
  issued_at           timestamptz,
  due_at              timestamptz,
  paid_at             timestamptz,
  provider_invoice_id text,
  pdf_path            text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint billing_invoices_id_company_unique unique (id, company_id),
  constraint billing_invoices_total_matches check (total = subtotal + tax_total),
  constraint billing_invoices_paid_shape check (status <> 'paid' or paid_at is not null),
  constraint billing_invoices_subscription_fk foreign key (subscription_id, company_id)
    references public.subscriptions (id, company_id)
);

create index billing_invoices_company_issued_idx on public.billing_invoices (company_id, issued_at desc);
create index billing_invoices_subscription_idx on public.billing_invoices (subscription_id);
create trigger billing_invoices_set_updated_at before update on public.billing_invoices
  for each row execute function public.set_updated_at();

create table public.billing_payments (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  invoice_id          uuid not null,
  amount              numeric(12, 2) not null check (amount > 0),
  currency            char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  method              text not null check (method in ('card', 'bank_transfer', 'cash', 'other')),
  status              text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  provider_payment_id text,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint billing_payments_invoice_fk foreign key (invoice_id, company_id)
    references public.billing_invoices (id, company_id)
);

create index billing_payments_invoice_idx on public.billing_payments (invoice_id);
create index billing_payments_company_idx on public.billing_payments (company_id, created_at desc);
create trigger billing_payments_set_updated_at before update on public.billing_payments
  for each row execute function public.set_updated_at();
