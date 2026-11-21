-- Identity (profiles, platform admins), tenancy (companies, members) and RBAC (roles, permissions).

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text check (full_name is null or char_length(full_name) <= 120),
  phone       text check (phone is null or char_length(phone) <= 32),
  avatar_path text,
  locale      text not null default 'sq' check (locale in ('sq', 'en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Platform operators. Writable only by the service role / SQL console.
create table public.platform_admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(btrim(name)) between 2 and 120),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  legal_name      text check (legal_name is null or char_length(legal_name) <= 200),
  business_number text check (business_number is null or business_number ~ '^[0-9]{6,12}$'), -- NUI
  fiscal_number   text check (fiscal_number is null or fiscal_number ~ '^[0-9]{6,12}$'),
  vat_number      text check (vat_number is null or char_length(vat_number) <= 32),
  email           text check (email is null or char_length(email) <= 254),
  phone           text check (phone is null or char_length(phone) <= 32),
  address         text check (address is null or char_length(address) <= 300),
  city            text check (city is null or char_length(city) <= 100),
  country_code    char(2) not null default 'XK' check (country_code ~ '^[A-Z]{2}$'),
  currency        char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  timezone        text not null default 'Europe/Belgrade',
  default_locale  text not null default 'sq' check (default_locale in ('sq', 'en')),
  logo_path       text,
  status          text not null default 'active' check (status in ('active', 'suspended')),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index companies_created_by_idx on public.companies (created_by);
create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- System roles have company_id NULL. Companies may later define custom roles.
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z][a-z0-9_]{1,49}$'),
  name        text not null check (char_length(name) between 1 and 80),
  description text,
  scope       text not null default 'company' check (scope in ('platform', 'company')),
  is_system   boolean not null default false,
  rank        integer not null default 0 check (rank between 0 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint roles_system_shape check (
    (is_system and company_id is null)
    or (not is_system and company_id is not null and scope = 'company')
  ),
  constraint roles_company_key_unique unique nulls not distinct (company_id, key)
);

create index roles_company_id_idx on public.roles (company_id);
create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

create table public.permissions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module      text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on update cascade on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create index role_permissions_permission_idx on public.role_permissions (permission_key);

create table public.company_members (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_id    uuid not null references public.roles (id),
  status     text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  job_title  text check (job_title is null or char_length(job_title) <= 100),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint company_members_company_user_unique unique (company_id, user_id)
);

create index company_members_user_id_idx on public.company_members (user_id);
create index company_members_role_id_idx on public.company_members (role_id);
create trigger company_members_set_updated_at before update on public.company_members
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user; keep the email copy in sync.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (
    new.id,
    new.email,
    nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 120), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'sq' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();
