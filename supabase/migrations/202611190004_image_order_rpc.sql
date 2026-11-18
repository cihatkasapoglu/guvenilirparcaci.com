-- Permit temporary positions only inside the transaction-safe image ordering RPC.
alter table public.listing_images
  drop constraint if exists listing_images_display_order_check;
alter table public.listing_images
  add constraint listing_images_display_order_check
  check (display_order between 1 and 10);

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
  v_distinct_count integer;
begin
  if not exists (
    select 1 from public.listings
    where id = p_listing_id and firm_id = p_firm_id
  ) then
    raise exception 'Listing not found for this firm';
  end if;

  if p_image_ids is null or cardinality(p_image_ids) > 5 then
    raise exception 'Invalid image order';
  end if;

  select count(*), count(distinct x)
    into v_count, v_distinct_count
  from unnest(p_image_ids) as x;

  if v_count <> v_distinct_count
     or v_count <> (select count(*) from public.listing_images where listing_id = p_listing_id)
     or exists (
       select 1 from public.listing_images li
       where li.listing_id = p_listing_id
         and not (li.id = any(p_image_ids))
     ) then
    raise exception 'Image list must contain every image exactly once';
  end if;

  update public.listing_images
     set display_order = 5 + ordinality::smallint,
         is_cover = false
    from unnest(p_image_ids) with ordinality as requested(image_id, ordinality)
   where listing_images.id = requested.image_id
     and listing_images.listing_id = p_listing_id;

  update public.listing_images
     set display_order = requested.ordinality::smallint,
         is_cover = (requested.ordinality = 1)
    from unnest(p_image_ids) with ordinality as requested(image_id, ordinality)
   where listing_images.id = requested.image_id
     and listing_images.listing_id = p_listing_id;
end;
$$;

revoke all on function public.set_listing_image_order(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_listing_image_order(uuid, uuid, uuid[]) to service_role;
