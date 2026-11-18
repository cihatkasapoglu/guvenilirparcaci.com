-- Güvenilir Parçacı - secure seller listing workflows
-- Apply after migrations 001-004. These RPCs are callable only by service_role;
-- the Edge Function validates the signed-in owner before invoking them.

create or replace function public.save_firm_listing(
  p_firm_id uuid,
  p_listing_id uuid,
  p_payload jsonb,
  p_compatibilities jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_existing public.listings%rowtype;
  v_category_id bigint;
  v_subcategory_id bigint;
  v_part_type text;
  v_title text;
  v_slug text;
  v_description text;
  v_fuel_type text;
  v_engine_code text;
  v_oem_number text;
  v_price_type text;
  v_price numeric(12,2);
  v_compat jsonb;
  v_model_id bigint;
  v_year_from smallint;
  v_year_to smallint;
begin
  if not exists (select 1 from public.firms where id = p_firm_id and status = 'active') then
    raise exception 'Aktif firma kaydı bulunamadı.';
  end if;

  v_category_id := nullif(p_payload->>'category_id', '')::bigint;
  v_subcategory_id := nullif(p_payload->>'subcategory_id', '')::bigint;
  v_part_type := p_payload->>'part_type';
  v_title := trim(coalesce(p_payload->>'title', ''));
  v_slug := trim(coalesce(p_payload->>'slug', ''));
  v_description := trim(coalesce(p_payload->>'description', ''));
  v_fuel_type := nullif(trim(p_payload->>'fuel_type'), '');
  v_engine_code := nullif(trim(p_payload->>'engine_code'), '');
  v_oem_number := nullif(trim(p_payload->>'oem_number'), '');
  v_price_type := p_payload->>'price_type';
  v_price := nullif(p_payload->>'price_try', '')::numeric;

  if v_title = '' or char_length(v_title) < 5 or char_length(v_title) > 120 then
    raise exception 'İlan başlığı 5-120 karakter arasında olmalıdır.';
  end if;
  if v_description = '' or char_length(v_description) < 20 or char_length(v_description) > 10000 then
    raise exception 'İlan açıklaması 20-10000 karakter arasında olmalıdır.';
  end if;
  if v_part_type not in ('new','used') then
    raise exception 'Parça türü geçersiz.';
  end if;
  if v_price_type not in ('fixed','negotiable','ask') then
    raise exception 'Fiyat türü geçersiz.';
  end if;
  if (v_price_type = 'ask' and v_price is not null)
     or (v_price_type in ('fixed','negotiable') and (v_price is null or v_price < 0)) then
    raise exception 'Fiyat bilgisi seçilen fiyat türüyle uyumlu değil.';
  end if;
  if not exists (select 1 from public.categories where id = v_category_id and is_active) then
    raise exception 'Kategori bulunamadı veya kullanıma kapalı.';
  end if;
  if v_subcategory_id is not null and not exists (
    select 1 from public.subcategories
    where id = v_subcategory_id and category_id = v_category_id and is_active
  ) then
    raise exception 'Alt kategori seçilen kategoriyle eşleşmiyor.';
  end if;

  if p_compatibilities is null or jsonb_typeof(p_compatibilities) <> 'array'
     or jsonb_array_length(p_compatibilities) < 1
     or jsonb_array_length(p_compatibilities) > 20 then
    raise exception 'En az bir, en fazla 20 araç uyumluluğu eklemelisiniz.';
  end if;

  if p_listing_id is null then
    if v_slug = '' or char_length(v_slug) > 160 then
      raise exception 'İlan bağlantı adı geçersiz.';
    end if;
    insert into public.listings (
      firm_id, category_id, subcategory_id, part_type, title, slug, description,
      fuel_type, engine_code, oem_number, price_try, price_type, status
    ) values (
      p_firm_id, v_category_id, v_subcategory_id, v_part_type, v_title, v_slug, v_description,
      v_fuel_type, v_engine_code, v_oem_number, v_price, v_price_type, 'draft'
    ) returning id into v_listing_id;
  else
    select * into v_existing
    from public.listings
    where id = p_listing_id and firm_id = p_firm_id
    for update;
    if not found then raise exception 'İlan bulunamadı veya size ait değil.'; end if;
    if v_existing.status in ('removed') then raise exception 'Silinmiş ilan düzenlenemez.'; end if;

    update public.listings set
      category_id = v_category_id,
      subcategory_id = v_subcategory_id,
      part_type = v_part_type,
      title = v_title,
      description = v_description,
      fuel_type = v_fuel_type,
      engine_code = v_engine_code,
      oem_number = v_oem_number,
      price_try = v_price,
      price_type = v_price_type,
      updated_at = now()
    where id = p_listing_id and firm_id = p_firm_id
    returning id into v_listing_id;
  end if;

  delete from public.listing_vehicle_compatibilities where listing_id = v_listing_id;

  for v_compat in select value from jsonb_array_elements(p_compatibilities)
  loop
    v_model_id := nullif(v_compat->>'vehicle_model_id', '')::bigint;
    v_year_from := nullif(v_compat->>'year_from', '')::smallint;
    v_year_to := nullif(v_compat->>'year_to', '')::smallint;

    if not exists (
      select 1 from public.vehicle_models vm
      join public.vehicle_brands vb on vb.id = vm.brand_id
      join public.vehicle_types vt on vt.id = vb.vehicle_type_id
      where vm.id = v_model_id and vm.is_active and vb.is_active and vt.is_active
    ) then
      raise exception 'Araç marka/model seçimi geçersiz.';
    end if;
    if (v_year_from is not null and v_year_from not between 1900 and 2100)
       or (v_year_to is not null and v_year_to not between 1900 and 2100)
       or (v_year_from is not null and v_year_to is not null and v_year_to < v_year_from) then
      raise exception 'Araç model yılı aralığı geçersiz.';
    end if;

    insert into public.listing_vehicle_compatibilities
      (listing_id, vehicle_model_id, year_from, year_to)
    values (v_listing_id, v_model_id, v_year_from, v_year_to);
  end loop;

  return v_listing_id;
end;
$$;

revoke all on function public.save_firm_listing(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_firm_listing(uuid, uuid, jsonb, jsonb) to service_role;

create or replace function public.publish_firm_listing(p_firm_id uuid, p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings%rowtype;
  v_quota integer;
  v_active_count integer;
  v_image_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_firm_id::text, 0));

  if not exists (select 1 from public.firms where id = p_firm_id and status = 'active') then
    raise exception 'Aktif firma kaydı bulunamadı.';
  end if;

  select pkg.listing_quota into v_quota
  from public.memberships m
  join public.packages pkg on pkg.id = m.package_id
  where m.firm_id = p_firm_id
    and m.status = 'active'
    and m.starts_at <= now()
    and m.ends_at > now()
    and pkg.is_active
  order by m.ends_at desc
  limit 1;

  if v_quota is null then raise exception 'İlan yayınlamak için aktif üyeliğiniz bulunmalıdır.'; end if;

  select * into v_listing from public.listings
  where id = p_listing_id and firm_id = p_firm_id
  for update;
  if not found then raise exception 'İlan bulunamadı veya size ait değil.'; end if;

  if v_listing.status not in ('draft','withdrawn') then
    raise exception 'Yalnızca taslak veya yayından kaldırılmış ilan yayınlanabilir. Süresi geçen ilanı yenileme alanından yenileyin.';
  end if;

  select count(*) into v_image_count from public.listing_images where listing_id = p_listing_id;
  if v_image_count < 1 or v_image_count > 5 then
    raise exception 'İlanı yayınlamak için 1-5 fotoğraf eklemelisiniz.';
  end if;

  select count(*) into v_active_count from public.listings
  where firm_id = p_firm_id and status = 'published' and expires_at > now();
  if v_active_count >= v_quota then
    raise exception 'Aktif ilan kotanız dolu. Paketinizde yer açın veya paketinizi yükseltin.';
  end if;

  update public.listings set
    status = 'published',
    published_at = now(),
    expires_at = now() + interval '30 days',
    updated_at = now()
  where id = p_listing_id;

  return jsonb_build_object('listing_id', p_listing_id, 'status', 'published',
    'expires_at', now() + interval '30 days', 'active_listing_count', v_active_count + 1,
    'listing_quota', v_quota);
end;
$$;

revoke all on function public.publish_firm_listing(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_firm_listing(uuid, uuid) to service_role;
