-- BizFlow foundation: shared utility functions used by every later migration.
-- gen_random_uuid() is built into Postgres 13+, so no extension is required.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Lowercase, ASCII-folded (Albanian ë/ç), dash-separated slug.
create or replace function public.slugify(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_value, '')), 'ëçéèáàäöüóòíìúù', 'eceeaaaoouooiiuu'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- Returns NULL instead of raising for malformed input (used for storage paths).
create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;
