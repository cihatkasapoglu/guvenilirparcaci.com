-- Public listing search RPC with bounded pagination.
-- Run after marketplace-foundation.sql and marketplace-directory-data.sql.

create or replace function public.gp_search_listings(
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
  total_count bigint
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
      f.name as firm_name, f.phone as firm_phone, f.whatsapp as firm_whatsapp,
      count(*) over() as total_count
    from public.gp_listings l
    join public.gp_firms f on f.id = l.firm_id
    left join public.gp_categories c on c.id = l.category_id
    where l.status = 'active'
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
  )
  select * from matched
  order by published_at desc nulls last, id desc
  limit least(greatest(coalesce(p_page_size,24),1),48)
  offset (greatest(coalesce(p_page,1),1)-1) * least(greatest(coalesce(p_page_size,24),1),48);
$function$;

revoke all on function public.gp_search_listings(text,uuid,text,text,text,text,text,text,numeric,numeric,integer,integer) from public;
grant execute on function public.gp_search_listings(text,uuid,text,text,text,text,text,text,numeric,numeric,integer,integer) to anon, authenticated;
