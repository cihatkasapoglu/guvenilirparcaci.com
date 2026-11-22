-- Private storage for unpublished listing images.
-- Firm logos/covers and published listing photos stay in the public site-images bucket.
drop policy if exists "draft_listing_images_owner_read" on storage.objects;
create policy "draft_listing_images_owner_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'site-images-drafts'
  and exists (
    select 1
    from public.listings l
    join public.firms f on f.id = l.firm_id
    where l.id = case
      when (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      then (storage.foldername(name))[2]::uuid
      else null
    end
    and f.owner_user_id = auth.uid()
  )
);

drop policy if exists "draft_listing_images_owner_upload" on storage.objects;
create policy "draft_listing_images_owner_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-images-drafts'
  and exists (
    select 1
    from public.listings l
    join public.firms f on f.id = l.firm_id
    where l.id = case
      when (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      then (storage.foldername(name))[2]::uuid
      else null
    end
    and f.owner_user_id = auth.uid()
  )
);
