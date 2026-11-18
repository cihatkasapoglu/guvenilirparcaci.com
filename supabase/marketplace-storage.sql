-- Supabase Storage bucket and access policies for marketplace listing images.
-- Run after marketplace-foundation.sql and marketplace-directory-data.sql.
-- Public image delivery is intentional for indexable public listing pages.
-- Upload path format: <firm-id>/<listing-uuid>/<random-file-name>.webp

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gp-listing-images',
  'gp-listing-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gp_listing_images_storage_public_read on storage.objects;
create policy gp_listing_images_storage_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id = 'gp-listing-images');

drop policy if exists gp_listing_images_storage_firm_insert on storage.objects;
create policy gp_listing_images_storage_firm_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gp-listing-images'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.gp_listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.firm_id = (storage.foldername(name))[1]
      and public.gp_can_manage_firm(l.firm_id)
      and exists (select 1 from public.gp_firms f where f.id = l.firm_id and f.status = 'active')
  )
);

drop policy if exists gp_listing_images_storage_firm_update on storage.objects;
create policy gp_listing_images_storage_firm_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'gp-listing-images'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.gp_listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.firm_id = (storage.foldername(name))[1]
      and public.gp_can_manage_firm(l.firm_id)
  )
)
with check (
  bucket_id = 'gp-listing-images'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.gp_listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.firm_id = (storage.foldername(name))[1]
      and public.gp_can_manage_firm(l.firm_id)
  )
);

drop policy if exists gp_listing_images_storage_firm_delete on storage.objects;
create policy gp_listing_images_storage_firm_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gp-listing-images'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.gp_listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.firm_id = (storage.foldername(name))[1]
      and public.gp_can_manage_firm(l.firm_id)
  )
);

commit;

-- Upload constraints:
-- * maximum file size: 5 MB
-- * MIME types: JPEG, PNG, WebP, AVIF
-- * frontend should resize/compress to WebP/AVIF and generate thumbnail/detail sizes
-- * use UUID filenames; never trust original user-supplied filenames
-- * do not upload a listing image before its listing row exists
