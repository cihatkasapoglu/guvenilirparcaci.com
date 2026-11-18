-- Seller image ordering and cover selection.
-- Apply after migrations 001-008.
create or replace function public.set_listing_image_order(
  p_firm_id uuid,
  p_listing_id uuid,
  p_image_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_distinct integer;
  v_existing integer;
begin
  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id and l.firm_id = p_firm_id
  ) then
    raise exception 'İlan bulunamadı veya size ait değil.';
  end if;

  if p_image_ids is null or cardinality(p_image_ids) < 1 or cardinality(p_image_ids) > 5 then
    raise exception 'Fotoğraf sıralaması 1-5 fotoğraf içermelidir.';
  end if;

  select count(*), count(distinct x)
    into v_count, v_distinct
  from unnest(p_image_ids) as x;
  if v_count <> v_distinct then
    raise exception 'Fotoğraf listesinde tekrar eden kayıt var.';
  end if;

  select count(*) into v_existing
  from public.listing_images
  where listing_id = p_listing_id;
  if v_existing <> v_count or exists (
    select 1 from public.listing_images
    where listing_id = p_listing_id
      and id <> all(p_image_ids)
  ) then
    raise exception 'Fotoğraf listesi güncel değil. Sayfayı yenileyip tekrar deneyin.';
  end if;

  -- Delete/reinsert in one transaction avoids collisions on the unique order index.
  with ordered as (
    select id, r2_object_key, ordinality::smallint as new_order
    from unnest(p_image_ids) with ordinality as u(id, ordinality)
  )
  delete from public.listing_images where listing_id = p_listing_id;

  insert into public.listing_images (id, listing_id, r2_object_key, display_order, is_cover)
  select o.id, p_listing_id, o.r2_object_key, o.new_order, o.new_order = 1
  from (
    select id, r2_object_key, ordinality::smallint as new_order
    from unnest(p_image_ids) with ordinality as u(id, ordinality)
    join public.listing_images li on li.id = u.id
  ) o;
end;
$$;

revoke all on function public.set_listing_image_order(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_listing_image_order(uuid, uuid, uuid[]) to service_role;
