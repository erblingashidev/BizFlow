-- Minimal stand-in for the parts of a Supabase database that BizFlow migrations rely on,
-- so they can be applied and tested on a plain Postgres instance (no Docker needed).
-- NOT a migration: never run this against a real Supabase project.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth;
create schema if not exists storage;

-- Skipped when a real Supabase Auth (GoTrue) server has already migrated the auth schema.
do $stub$
begin
  if to_regclass('auth.users') is null then
    create table auth.users (
      id                 uuid primary key default gen_random_uuid(),
      email              text unique,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at         timestamptz not null default now()
    );

    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(coalesce(
        current_setting('request.jwt.claim.sub', true),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      ), '')::uuid;
    $$;

    create or replace function auth.role() returns text
    language sql stable as $$
      select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
    $$;
  end if;
end;
$stub$;

-- Skipped when a real Supabase Storage server has already migrated the storage schema.
do $stub$
begin
  if to_regclass('storage.objects') is null then
    create table storage.buckets (
      id                 text primary key,
      name               text not null,
      public             boolean default false,
      file_size_limit    bigint,
      allowed_mime_types text[]
    );

    create table storage.objects (
      id         uuid primary key default gen_random_uuid(),
      bucket_id  text references storage.buckets (id),
      name       text not null,
      owner      uuid,
      created_at timestamptz default now()
    );
    alter table storage.objects enable row level security;

    create or replace function storage.foldername(name text) returns text[]
    language plpgsql immutable as $$
    declare
      parts text[] := string_to_array(name, '/');
    begin
      return parts[1 : array_length(parts, 1) - 1];
    end;
    $$;

    grant select, insert, update, delete on storage.objects to authenticated, service_role;
    grant select on storage.buckets to authenticated, service_role;
  end if;
end;
$stub$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Mirror Supabase's default privileges on the public schema.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
