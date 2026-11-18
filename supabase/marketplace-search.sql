begin;

-- Public listing search RPC with bounded, count-free pagination.
-- Run after marketplace-foundation.sql.
-- Returns one extra-row has_more signal rather than calculating an expensive exact count.

drop function if exists public.gp_search_listings(text,uuid,text,text,text,text,text,text,numeric,numeric,integer,integer);

create function public.gp_search_listings(
  p_query text default null,
  p_category_id uuid default null,
  p_condition text default null,
  p_vehicle_brand text default null,
  p_vehicle_model text default null,
  p_city text default null,
  p_engine_code text default null,
  p_oem_code text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_page integer default 1,
  p_page_size integer default 24
)
returns table (
  id uuid,
  firm_id text,
  title text,
  slug text,
  description text,
  condition text,
  category_id uuid,
  category_name text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_year_from smallint,
  vehicle_year_to smallint,
  engine_code text,
  oem_code text,
  part_number text,
  price numeric,
  currency char(3),
  price_type text,
  city text,
  district text,
  published_at timestamptz,
  firm_name text,
  firm_phone text,
  firm_whatsapp text,
  has_more boolean
)
language sql
stable
security invoker
set search_path = public
as $function$
  with matched as (
    select
      l.id, l.firm_id, l.title, l.slug, l.description, l.condition,
      l.category_id, c.name as category_name,
      l.vehicle_brand, l.vehicle_model, l.vehicle_year_from, l.vehicle_year_to,
      l.engine_code, l.oem_code, l.part_number, l.price, l.currency, l.price_type,
      l.city, l.district, l.published_at,
      f.name as firm_name, f.phone as firm_phone, f.whatsapp as firm_whatsapp
    from public.gp_listings l
    join public.gp_firms f on f.id = l.firm_id
    left join public.gp_categories c on c.id = l.category_id
    where l.status = 'active'
      and (l.expires_at is null or l.expires_at > now())
      and f.status = 'active'
      and public.gp_firm_publicly_visible(f.id)
      and (
        nullif(btrim(p_query),'') is null
        or to_tsvector('simple',
          coalesce(l.title,'') || ' ' || coalesce(l.description,'') || ' ' ||
          coalesce(l.vehicle_brand,'') || ' ' || coalesce(l.vehicle_model,'') || ' ' ||
          coalesce(l.engine_code,'') || ' ' || coalesce(l.oem_code,'') || ' ' ||
          coalesce(l.part_number,'')
        ) @@ websearch_to_tsquery('simple', btrim(p_query))
      )
      and (p_category_id is null or l.category_id = p_category_id)
      and (p_condition is null or l.condition = p_condition)
      and (nullif(btrim(p_vehicle_brand),'') is null or l.vehicle_brand = btrim(p_vehicle_brand))
      and (nullif(btrim(p_vehicle_model),'') is null or l.vehicle_model ilike '%' || btrim(p_vehicle_model) || '%')
      and (nullif(btrim(p_city),'') is null or l.city ilike '%' || btrim(p_city) || '%')
      and (nullif(btrim(p_engine_code),'') is null or l.engine_code ilike '%' || btrim(p_engine_code) || '%')
      and (nullif(btrim(p_oem_code),'') is null or l.oem_code ilike '%' || btrim(p_oem_code) || '%')
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
  ),
  page_rows as (
    select *
    from matched
    order by published_at desc nulls last, id desc
    limit least(greatest(coalesce(p_page_size,24),1),48) + 1
    offset (least(greatest(coalesce(p_page,1),1),10000)-1) * least(greatest(coalesce(p_page_size,24),1),48)
  ),
  numbered as (
    select page_rows.*, count(*) over() > least(greatest(coalesce(p_page_size,24),1),48) as has_more
    from page_rows
  )
  select
    id,firm_id,title,slug,description,condition,category_id,category_name,
    vehicle_brand,vehicle_model,vehicle_year_from,vehicle_year_to,engine_code,
    oem_code,part_number,price,currency,price_type,city,district,published_at,
    firm_name,firm_phone,firm_whatsapp,has_more
  from numbered
  order by published_at desc nulls last, id desc
  limit least(greatest(coalesce(p_page_size,24),1),48);
$function$;

revoke all on function public.gp_search_listings(text,uuid,text,text,text,text,text,text,numeric,numeric,integer,integer) from public;
grant execute on function public.gp_search_listings(text,uuid,text,text,text,text,text,text,numeric,numeric,integer,integer) to anon, authenticated;

commit;
