-- Private storage buckets. Object paths must start with the company id:
--   receipts/{company_id}/{expense_id}/{file}
--   company-assets/{company_id}/{file}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('receipts', 'receipts', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('company-assets', 'company-assets', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts'
         and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'expenses.view'));

create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts'
              and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'expenses.create'));

create policy receipts_update on storage.objects for update to authenticated
  using (bucket_id = 'receipts'
         and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'expenses.update'))
  with check (bucket_id = 'receipts'
              and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'expenses.update'));

create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts'
         and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'expenses.delete'));

create policy company_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'company-assets'
         and public.is_member(public.try_uuid((storage.foldername(name))[1])));

create policy company_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'company-assets'
              and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'company.settings'));

create policy company_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'company-assets'
         and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'company.settings'))
  with check (bucket_id = 'company-assets'
              and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'company.settings'));

create policy company_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'company-assets'
         and public.has_permission(public.try_uuid((storage.foldername(name))[1]), 'company.settings'));
