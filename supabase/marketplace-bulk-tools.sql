-- Firm-side bulk price and stock update RPC.
-- Run after marketplace-foundation.sql.

begin;

create or replace function public.gp_firm_bulk_update_listing_values(p_updates jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, auth
as $function$
declare
  rec record;
  v_count integer := 0;
begin
  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'Güncelleme verisi bir JSON dizisi olmalıdır.';
  end if;

  if jsonb_array_length(p_updates) > 500 then
    raise exception 'Tek seferde en fazla 500 ilan güncellenebilir.';
  end if;

  for rec in
    select *
    from jsonb_to_recordset(p_updates) as x(
      listing_id uuid,
      price numeric,
      price_type text,
      stock_quantity integer
    )
  loop
    if rec.listing_id is null then
      raise exception 'Her satırda listing_id bulunmalıdır.';
    end if;

    if rec.price is not null and rec.price < 0 then
      raise exception 'Fiyat negatif olamaz.';
    end if;

    if rec.stock_quantity is not null and rec.stock_quantity < 0 then
      raise exception 'Stok adedi negatif olamaz.';
    end if;

    if rec.price_type is not null and rec.price_type not in ('fixed','contact','negotiable') then
      raise exception 'Geçersiz fiyat türü.';
    end if;

    update public.gp_listings l
    set price = coalesce(rec.price, l.price),
        price_type = coalesce(rec.price_type, l.price_type),
        stock_quantity = coalesce(rec.stock_quantity, l.stock_quantity),
        updated_at = now()
    where l.id = rec.listing_id
      and public.gp_can_manage_firm(l.firm_id);

    if not found then
      raise exception 'İlan bulunamadı veya bu ilanı güncelleme yetkiniz yok: %', rec.listing_id;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.gp_firm_bulk_update_listing_values(jsonb) from public;
grant execute on function public.gp_firm_bulk_update_listing_values(jsonb) to authenticated;

commit;
