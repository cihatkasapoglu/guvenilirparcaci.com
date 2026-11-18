-- GüvenilirParçacı marketplace foundation
-- Draft migration. Review in Supabase SQL Editor on a staging project before production.
-- PRE-REQUISITE: run supabase/membership-management.sql first (gp_is_admin() is reused).
-- Existing gp_memberships, gp_membership_payments, gp_admins and public firm pages are preserved.

begin;

create extension if not exists pgcrypto;

-- Firms are the seller accounts. Existing GP_FIRMS ids can be retained as text IDs
-- during the later data migration, so existing /firma.html?id=... links need not change.
create table if not exists public.gp_firms (
  id text primary key,
  name text not null,
  slug text not null unique,
  logo_url text,
  short_description text,
  description text,
  phone text,
  phone_secondary text,
  whatsapp text,
  whatsapp_secondary text,
  website text,
  address text,
  city text,
  district text,
  status text not null default 'pending'
    check (status in ('pending','active','suspended','closed')),
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gp_firms_status_city_idx
  on public.gp_firms(status, city);

-- A user may work for more than one firm. A firm may have several authorized users.
create table if not exists public.gp_firm_users (
  id uuid primary key default gen_random_uuid(),
  firm_id text not null references public.gp_firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor'
    check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  unique (firm_id, user_id)
);
create index if not exists gp_firm_users_user_idx on public.gp_firm_users(user_id);
create index if not exists gp_firm_users_firm_idx on public.gp_firm_users(firm_id);

create table if not exists public.gp_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.gp_categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists gp_categories_parent_idx
  on public.gp_categories(parent_id, sort_order) where is_active = true;

create table if not exists public.gp_listings (
  id uuid primary key default gen_random_uuid(),
  firm_id text not null references public.gp_firms(id) on delete restrict,
  category_id uuid references public.gp_categories(id) on delete set null,
  title text not null,
  slug text not null,
  description text,
  condition text not null
    check (condition in ('new','used','reconditioned')),
  status text not null default 'draft'
    check (status in ('draft','pending','active','sold','expired','rejected')),
  vehicle_brand text,
  vehicle_model text,
  vehicle_year_from smallint,
  vehicle_year_to smallint,
  engine_code text,
  oem_code text,
  part_number text,
  price numeric(14,2) check (price is null or price >= 0),
  currency char(3) not null default 'TRY',
  price_type text not null default 'contact'
    check (price_type in ('fixed','contact','negotiable')),
  stock_quantity integer not null default 1 check (stock_quantity >= 0),
  warranty_info text,
  city text,
  district text,
  attributes jsonb not null default '{}'::jsonb,
  view_count bigint not null default 0 check (view_count >= 0),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, slug),
  check (vehicle_year_from is null or vehicle_year_from between 1900 and 2200),
  check (vehicle_year_to is null or vehicle_year_to between 1900 and 2200),
  check (vehicle_year_from is null or vehicle_year_to is null or vehicle_year_to >= vehicle_year_from),
  check (price_type <> 'fixed' or price is not null)
);

-- Keep timestamps server-controlled; clients do not need UPDATE permission on updated_at.
create or replace function public.gp_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists gp_firms_touch_updated_at on public.gp_firms;
create trigger gp_firms_touch_updated_at
before update on public.gp_firms
for each row execute function public.gp_touch_updated_at();

drop trigger if exists gp_listings_touch_updated_at on public.gp_listings;
create trigger gp_listings_touch_updated_at
before update on public.gp_listings
for each row execute function public.gp_touch_updated_at();

-- Search/filter indexes for the public catalogue and firm dashboard.
create index if not exists gp_listings_public_recent_idx
  on public.gp_listings(published_at desc, id)
  where status = 'active';
create index if not exists gp_listings_firm_status_idx
  on public.gp_listings(firm_id, status, updated_at desc);
create index if not exists gp_listings_category_idx
  on public.gp_listings(category_id, published_at desc)
  where status = 'active';
create index if not exists gp_listings_brand_model_idx
  on public.gp_listings(vehicle_brand, vehicle_model)
  where status = 'active';
create index if not exists gp_listings_engine_code_idx
  on public.gp_listings(engine_code)
  where status = 'active';
create index if not exists gp_listings_oem_code_idx
  on public.gp_listings(oem_code)
  where status = 'active';
create index if not exists gp_listings_price_idx
  on public.gp_listings(price)
  where status = 'active' and price is not null;
create index if not exists gp_listings_city_recent_idx
  on public.gp_listings(city, published_at desc)
  where status = 'active' and city is not null;
create index if not exists gp_listings_condition_recent_idx
  on public.gp_listings(condition, published_at desc)
  where status = 'active';
create index if not exists gp_listings_firm_part_number_idx
  on public.gp_listings(firm_id, part_number)
  where part_number is not null;
create index if not exists gp_listings_search_idx
  on public.gp_listings using gin (
    to_tsvector('simple',
      coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
      coalesce(vehicle_brand,'') || ' ' || coalesce(vehicle_model,'') || ' ' ||
      coalesce(engine_code,'') || ' ' || coalesce(oem_code,'') || ' ' ||
      coalesce(part_number,'')
    )
  );

create table if not exists public.gp_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.gp_listings(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order smallint not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  unique (listing_id, storage_path)
);
create index if not exists gp_listing_images_listing_idx
  on public.gp_listing_images(listing_id, sort_order);

-- Hard cap: ten images per listing. Advisory locking prevents concurrent uploads
-- from racing past the limit.
create or replace function public.gp_limit_listing_images()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(new.listing_id::text));
  select count(*) into v_count
  from public.gp_listing_images
  where listing_id = new.listing_id;

  if v_count >= 10 then
    raise exception 'Bir ilana en fazla 10 fotoğraf eklenebilir.';
  end if;
  return new;
end;
$function$;

drop trigger if exists gp_listing_images_limit_trigger on public.gp_listing_images;
create trigger gp_listing_images_limit_trigger
before insert on public.gp_listing_images
for each row execute function public.gp_limit_listing_images();
create unique index if not exists gp_listing_images_one_cover_idx
  on public.gp_listing_images(listing_id) where is_cover = true;

create table if not exists public.gp_listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.gp_listings(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  reason text not null
    check (reason in ('wrong_info','fraud','prohibited','duplicate','sold','other')),
  details text,
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists gp_listing_reports_status_idx
  on public.gp_listing_reports(status, created_at desc);

create table if not exists public.gp_listing_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.gp_listings(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);
create index if not exists gp_listing_events_listing_idx
  on public.gp_listing_events(listing_id, created_at desc);

-- Helper functions used by RLS. SECURITY DEFINER avoids recursive RLS evaluation
-- when checking the user's firm membership.
create or replace function public.gp_can_access_firm(p_firm_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.gp_firm_users fu
    where fu.firm_id = p_firm_id and fu.user_id = auth.uid()
  );
$$;

create or replace function public.gp_can_administer_firm(p_firm_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $function$
  select exists (
    select 1 from public.gp_firm_users fu
    where fu.firm_id = p_firm_id
      and fu.user_id = auth.uid()
      and fu.role in ('owner','admin')
  );
$function$;

create or replace function public.gp_can_manage_firm(p_firm_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.gp_firm_users fu
    where fu.firm_id = p_firm_id
      and fu.user_id = auth.uid()
      and fu.role in ('owner','admin','editor')
  );
$$;

-- Preserve the current directory's membership visibility behavior:
-- firms without a membership row remain visible; firms with a row must be paid/active.
create or replace function public.gp_firm_publicly_visible(p_firm_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $function$
  select exists (
    select 1
    from public.gp_firms f
    where f.id = p_firm_id
      and f.status = 'active'
      and (
        not exists (
          select 1 from public.gp_memberships m where m.firm_id = f.id
        )
        or exists (
          select 1 from public.gp_memberships m
          where m.firm_id = f.id
            and m.status = 'active'
            and m.ends_at is not null
            and m.ends_at >= current_date
        )
      )
  );
$function$;

revoke all on function public.gp_firm_publicly_visible(text) from public;
grant execute on function public.gp_firm_publicly_visible(text) to anon, authenticated;
revoke all on function public.gp_can_access_firm(text) from public;
revoke all on function public.gp_can_administer_firm(text) from public;
revoke all on function public.gp_can_manage_firm(text) from public;
grant execute on function public.gp_can_access_firm(text) to authenticated;
grant execute on function public.gp_can_administer_firm(text) to authenticated;
grant execute on function public.gp_can_manage_firm(text) to authenticated;

-- Row-level security is the actual access boundary, not just frontend filtering.
alter table public.gp_firms enable row level security;
alter table public.gp_firm_users enable row level security;
alter table public.gp_categories enable row level security;
alter table public.gp_listings enable row level security;
alter table public.gp_listing_images enable row level security;
alter table public.gp_listing_reports enable row level security;
alter table public.gp_listing_events enable row level security;

revoke all on public.gp_firms, public.gp_firm_users, public.gp_categories,
  public.gp_listings, public.gp_listing_images, public.gp_listing_reports,
  public.gp_listing_events from anon, authenticated;

grant select on public.gp_firms, public.gp_categories, public.gp_listings,
  public.gp_listing_images to anon, authenticated;
grant select, insert, update, delete on public.gp_firm_users to authenticated;
grant delete on public.gp_listings to authenticated;
grant insert (
  firm_id,category_id,title,slug,description,condition,vehicle_brand,vehicle_model,
  vehicle_year_from,vehicle_year_to,engine_code,oem_code,part_number,price,currency,
  price_type,stock_quantity,warranty_info,city,district,attributes,status
) on public.gp_listings to authenticated;
grant update (
  category_id,title,slug,description,condition,vehicle_brand,vehicle_model,
  vehicle_year_from,vehicle_year_to,engine_code,oem_code,part_number,
  price,currency,price_type,stock_quantity,warranty_info,city,district,
  attributes,status
) on public.gp_listings to authenticated;
grant delete on public.gp_listing_images to authenticated;
grant insert (listing_id,storage_path,alt_text,sort_order,is_cover) on public.gp_listing_images to authenticated;
grant update (alt_text,sort_order,is_cover) on public.gp_listing_images to authenticated;
revoke insert, update, delete on public.gp_firms from authenticated;
revoke insert on public.gp_listing_reports from anon, authenticated;
grant insert (listing_id,reporter_email,reason,details) on public.gp_listing_reports to anon, authenticated;
grant select, update on public.gp_listing_reports to authenticated;
grant select on public.gp_listing_events to authenticated;

drop policy if exists gp_firms_public_read on public.gp_firms;
create policy gp_firms_public_read on public.gp_firms
for select to anon, authenticated
using (public.gp_firm_publicly_visible(id));

drop policy if exists gp_firms_member_read on public.gp_firms;
create policy gp_firms_member_read on public.gp_firms
for select to authenticated
using (public.gp_can_access_firm(id) or public.gp_is_admin());

drop policy if exists gp_firms_admin_manage on public.gp_firms;
create policy gp_firms_admin_manage on public.gp_firms
for all to authenticated
using (public.gp_is_admin())
with check (public.gp_is_admin());

drop policy if exists gp_firm_users_read on public.gp_firm_users;
create policy gp_firm_users_read on public.gp_firm_users
for select to authenticated
using (user_id = auth.uid() or public.gp_can_manage_firm(firm_id) or public.gp_is_admin());

drop policy if exists gp_firm_users_admin_manage on public.gp_firm_users;
create policy gp_firm_users_admin_manage on public.gp_firm_users
for all to authenticated
using (public.gp_is_admin())
with check (public.gp_is_admin());

drop policy if exists gp_categories_public_read on public.gp_categories;
create policy gp_categories_public_read on public.gp_categories
for select to anon, authenticated
using (is_active = true);

drop policy if exists gp_categories_admin_manage on public.gp_categories;
create policy gp_categories_admin_manage on public.gp_categories
for all to authenticated
using (public.gp_is_admin())
with check (public.gp_is_admin());

drop policy if exists gp_listings_public_read on public.gp_listings;
create policy gp_listings_public_read on public.gp_listings
for select to anon, authenticated
using (
  status = 'active'
  and (expires_at is null or expires_at > now())
  and exists (
    select 1 from public.gp_firms f
    where f.id = gp_listings.firm_id
      and public.gp_firm_publicly_visible(f.id)
  )
);

drop policy if exists gp_listings_firm_read on public.gp_listings;
create policy gp_listings_firm_read on public.gp_listings
for select to authenticated
using (public.gp_can_access_firm(firm_id) or public.gp_is_admin());

drop policy if exists gp_listings_firm_insert on public.gp_listings;
create policy gp_listings_firm_insert on public.gp_listings
for insert to authenticated
with check (
  public.gp_can_manage_firm(firm_id)
  and exists (select 1 from public.gp_firms f where f.id = firm_id and f.status = 'active')
);

drop policy if exists gp_listings_firm_update on public.gp_listings;
create policy gp_listings_firm_update on public.gp_listings
for update to authenticated
using (
  public.gp_is_admin()
  or (
    public.gp_can_manage_firm(firm_id)
    and exists (select 1 from public.gp_firms f where f.id = firm_id and f.status = 'active')
  )
)
with check (
  public.gp_is_admin()
  or (
    public.gp_can_manage_firm(firm_id)
    and exists (select 1 from public.gp_firms f where f.id = firm_id and f.status = 'active')
  )
);

drop policy if exists gp_listings_firm_delete on public.gp_listings;
create policy gp_listings_firm_delete on public.gp_listings
for delete to authenticated
using (public.gp_can_manage_firm(firm_id) or public.gp_is_admin());

drop policy if exists gp_listing_images_public_read on public.gp_listing_images;
create policy gp_listing_images_public_read on public.gp_listing_images
for select to anon, authenticated
using (
  exists (
    select 1 from public.gp_listings l
    join public.gp_firms f on f.id = l.firm_id
    where l.id = gp_listing_images.listing_id
      and l.status = 'active'
      and (l.expires_at is null or l.expires_at > now())
      and public.gp_firm_publicly_visible(f.id)
  )
);

drop policy if exists gp_listing_images_firm_read on public.gp_listing_images;
create policy gp_listing_images_firm_read on public.gp_listing_images
for select to authenticated
using (
  exists (
    select 1 from public.gp_listings l
    where l.id = gp_listing_images.listing_id
      and (public.gp_can_access_firm(l.firm_id) or public.gp_is_admin())
  )
);

drop policy if exists gp_listing_images_firm_insert on public.gp_listing_images;
create policy gp_listing_images_firm_insert on public.gp_listing_images
for insert to authenticated
with check (
  exists (
    select 1 from public.gp_listings l
    where l.id = gp_listing_images.listing_id
      and public.gp_can_manage_firm(l.firm_id)
      and exists (select 1 from public.gp_firms f where f.id = l.firm_id and f.status = 'active')
  )
);

drop policy if exists gp_listing_images_firm_update on public.gp_listing_images;
create policy gp_listing_images_firm_update on public.gp_listing_images
for update to authenticated
using (
  exists (
    select 1 from public.gp_listings l
    where l.id = gp_listing_images.listing_id
      and (
        public.gp_is_admin()
        or (
          public.gp_can_manage_firm(l.firm_id)
          and exists (select 1 from public.gp_firms f where f.id = l.firm_id and f.status = 'active')
        )
      )
  )
)
with check (
  exists (
    select 1 from public.gp_listings l
    where l.id = gp_listing_images.listing_id
      and (
        public.gp_is_admin()
        or (
          public.gp_can_manage_firm(l.firm_id)
          and exists (select 1 from public.gp_firms f where f.id = l.firm_id and f.status = 'active')
        )
      )
  )
);

drop policy if exists gp_listing_images_firm_delete on public.gp_listing_images;
create policy gp_listing_images_firm_delete on public.gp_listing_images
for delete to authenticated
using (
  exists (
    select 1 from public.gp_listings l
    where l.id = gp_listing_images.listing_id
      and (public.gp_can_manage_firm(l.firm_id) or public.gp_is_admin())
  )
);

drop policy if exists gp_listing_reports_public_insert on public.gp_listing_reports;
create policy gp_listing_reports_public_insert on public.gp_listing_reports
for insert to anon, authenticated
with check (
  exists (
    select 1 from public.gp_listings l
    where l.id = gp_listing_reports.listing_id
      and l.status = 'active'
      and public.gp_firm_publicly_visible(l.firm_id)
  )
);

drop policy if exists gp_listing_reports_admin_read on public.gp_listing_reports;
create policy gp_listing_reports_admin_read on public.gp_listing_reports
for select to authenticated
using (public.gp_is_admin());

drop policy if exists gp_listing_reports_admin_update on public.gp_listing_reports;
create policy gp_listing_reports_admin_update on public.gp_listing_reports
for update to authenticated
using (public.gp_is_admin())
with check (public.gp_is_admin());

drop policy if exists gp_listing_events_member_read on public.gp_listing_events;
create policy gp_listing_events_member_read on public.gp_listing_events
for select to authenticated
using (
  exists (
    select 1 from public.gp_listings l
    where l.id = gp_listing_events.listing_id
      and (public.gp_can_access_firm(l.firm_id) or public.gp_is_admin())
  )
);

-- Record listing lifecycle changes without allowing clients to forge event history.
create or replace function public.gp_record_listing_event()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.gp_listing_events(listing_id, actor_user_id, event_type, new_status)
    values (new.id, auth.uid(), 'created', new.status);
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.gp_listing_events(listing_id, actor_user_id, event_type, old_status, new_status)
    values (new.id, auth.uid(), 'status_changed', old.status, new.status);
  else
    insert into public.gp_listing_events(listing_id, actor_user_id, event_type, old_status, new_status)
    values (new.id, auth.uid(), 'updated', old.status, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists gp_listings_event_trigger on public.gp_listings;
create trigger gp_listings_event_trigger
after insert or update on public.gp_listings
for each row execute function public.gp_record_listing_event();

-- A firm can submit and maintain its own listings, but cannot self-approve a new listing.
-- Only a site administrator may move a listing from draft/pending to active.
create or replace function public.gp_guard_listing_publication()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $function$
begin
  if not public.gp_is_admin() and current_user not in ('postgres','service_role') then
    if tg_op = 'INSERT' and new.status not in ('draft','pending') then
      raise exception 'Yeni ilanlar yönetici onayı olmadan yayınlanamaz.';
    end if;
    if tg_op = 'UPDATE' and new.status = 'active' and old.status <> 'active' then
      raise exception 'İlanı yayına alma yetkisi yalnızca yöneticidedir.';
    end if;
    if tg_op = 'UPDATE'
       and new.status in ('rejected','expired')
       and old.status is distinct from new.status then
      raise exception 'Bu ilan durumu yalnızca yönetici veya sistem tarafından atanabilir.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists gp_listings_publication_guard on public.gp_listings;
create trigger gp_listings_publication_guard
before insert or update on public.gp_listings
for each row execute function public.gp_guard_listing_publication();

commit;

-- Next steps (separate reviewed migrations):
-- 1. Import the existing 28 vehicle brands and current GP_FIRMS records without changing their IDs/slugs.
-- 2. Add a public image bucket and storage policies; image bytes must not be stored in PostgreSQL.
-- 3. Connect approved firm accounts to gp_firm_users; never allow public self-assignment to a firm.
-- 4. Add server-side limits for image count/size, listing quotas and plan entitlements.
-- 5. Add a transactional listing publication workflow and scheduled expiry process.
