-- Güvenilir Parçacı - Initial database foundation
-- This migration creates the marketplace schema only.
-- It does NOT create a Supabase project, storage bucket, admin account, or live deployment.
-- Apply only to a newly created Supabase project after reviewing the deployment checklist.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  contact_name text not null,
  phone text not null,
  whatsapp text not null,
  email text not null,
  tax_or_identity_number text not null,
  province text not null,
  district text not null,
  address text not null,
  description text,
  logo_object_key text,
  cover_object_key text,
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicle_types (
  id bigint generated always as identity primary key,
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.vehicle_brands (
  id bigint generated always as identity primary key,
  vehicle_type_id bigint references public.vehicle_types(id) on delete restrict,
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  unique (vehicle_type_id, slug)
);

create table public.vehicle_models (
  id bigint generated always as identity primary key,
  brand_id bigint not null references public.vehicle_brands(id) on delete cascade,
  name text not null,
  slug text not null,
  is_active boolean not null default true,
  unique (brand_id, slug)
);

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.subcategories (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.categories(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (category_id, slug)
);

create table public.packages (
  id bigint generated always as identity primary key,
  name text not null unique,
  listing_quota integer not null check (listing_quota > 0),
  price_try numeric(12,2) not null check (price_try >= 0),
  duration_days integer not null default 30 check (duration_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete restrict,
  package_id bigint not null references public.packages(id) on delete restrict,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'pending' check (status in ('pending','active','expired','rejected','cancelled')),
  approved_by uuid references public.admin_users(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at > starts_at))
);

create table public.payment_notifications (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete restrict,
  package_id bigint not null references public.packages(id) on delete restrict,
  membership_id uuid references public.memberships(id) on delete set null,
  sender_name text not null,
  amount_try numeric(12,2) not null check (amount_try > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.admin_users(user_id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete restrict,
  category_id bigint not null references public.categories(id) on delete restrict,
  subcategory_id bigint references public.subcategories(id) on delete set null,
  part_type text not null check (part_type in ('new','used')),
  title text not null,
  slug text not null,
  description text not null,
  fuel_type text,
  engine_code text,
  oem_number text,
  price_try numeric(12,2) check (price_try is null or price_try >= 0),
  price_type text not null check (price_type in ('fixed','negotiable','ask')),
  province text not null,
  district text not null,
  status text not null default 'draft' check (status in ('draft','published','expired','withdrawn','removed')),
  published_at timestamptz,
  expires_at timestamptz,
  view_count bigint not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, slug),
  check ((price_type = 'ask' and price_try is null) or (price_type in ('fixed','negotiable') and price_try is not null))
);

create table public.listing_vehicle_compatibilities (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  vehicle_model_id bigint not null references public.vehicle_models(id) on delete restrict,
  year_from smallint,
  year_to smallint,
  check (year_from is null or year_from between 1900 and 2100),
  check (year_to is null or year_to between 1900 and 2100),
  check (year_from is null or year_to is null or year_to >= year_from)
);
create unique index listing_vehicle_compatibility_unique_idx
  on public.listing_vehicle_compatibilities
  (listing_id, vehicle_model_id, coalesce(year_from, 0), coalesce(year_to, 0));

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  r2_object_key text not null unique,
  display_order smallint not null check (display_order between 1 and 5),
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  unique (listing_id, display_order)
);

create table public.listing_refreshes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete restrict,
  listing_id uuid not null references public.listings(id) on delete cascade,
  refresh_type text not null check (refresh_type in ('bump','republish')),
  used_at timestamptz not null default now(),
  turkey_day date not null default (timezone('Europe/Istanbul', now()))::date
);

create table public.featured_listings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  price_try numeric(12,2) not null check (price_try >= 0),
  duration_days integer not null check (duration_days > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  payment_status text not null default 'pending' check (payment_status in ('pending','approved','rejected')),
  status text not null default 'pending' check (status in ('pending','active','ended','cancelled')),
  approved_by uuid references public.admin_users(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.listing_views (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_fingerprint_hash text not null,
  viewed_on date not null default (timezone('Europe/Istanbul', now()))::date,
  created_at timestamptz not null default now(),
  unique (listing_id, viewer_fingerprint_hash, viewed_on)
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  email text not null,
  reason text not null,
  explanation text not null,
  status text not null default 'new' check (status in ('new','reviewing','resolved','dismissed')),
  reviewed_by uuid references public.admin_users(user_id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table public.admin_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid references public.admin_users(user_id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(user_id) on delete set null
);

-- Keep each listing's location synchronized with its firm's registered address.
create or replace function public.sync_listing_firm_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select f.province, f.district
    into new.province, new.district
  from public.firms f
  where f.id = new.firm_id;
  return new;
end;
$$;

create trigger listings_sync_firm_location
before insert or update of firm_id on public.listings
for each row execute function public.sync_listing_firm_location();

create or replace function public.sync_firm_listing_locations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.province is distinct from old.province or new.district is distinct from old.district then
    update public.listings
       set province = new.province,
           district = new.district,
           updated_at = now()
     where firm_id = new.id;
  end if;
  return new;
end;
$$;

create trigger firms_sync_listing_locations
after update of province, district on public.firms
for each row execute function public.sync_firm_listing_locations();

-- Create a profile after Supabase Auth creates a user.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Helpful indexes for marketplace search and dashboard queries.
create index listings_public_search_idx on public.listings (status, expires_at, published_at desc);
create index listings_firm_status_idx on public.listings (firm_id, status, expires_at);
create index listings_category_idx on public.listings (category_id, subcategory_id);
create index listings_location_idx on public.listings (province, district);
create index listings_engine_code_idx on public.listings (lower(engine_code)) where engine_code is not null;
create index listings_title_search_idx on public.listings using gin (to_tsvector('simple', title));
create index vehicle_models_brand_idx on public.vehicle_models (brand_id);
create index compatibility_model_idx on public.listing_vehicle_compatibilities (vehicle_model_id);
create index memberships_firm_status_idx on public.memberships (firm_id, status, ends_at desc);
create index payment_notifications_status_idx on public.payment_notifications (status, submitted_at desc);
create index listing_refreshes_firm_day_idx on public.listing_refreshes (firm_id, turkey_day);
create index featured_active_idx on public.featured_listings (status, starts_at, ends_at);
create index complaints_status_idx on public.complaints (status, created_at desc);

-- RLS is enabled now; narrowly scoped policies are added in the next migration
-- after the server-side membership, publication and admin workflows are defined.
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.firms enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.vehicle_brands enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.packages enable row level security;
alter table public.memberships enable row level security;
alter table public.payment_notifications enable row level security;
alter table public.listings enable row level security;
alter table public.listing_vehicle_compatibilities enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_refreshes enable row level security;
alter table public.featured_listings enable row level security;
alter table public.favorites enable row level security;
alter table public.listing_views enable row level security;
alter table public.complaints enable row level security;
alter table public.admin_logs enable row level security;
alter table public.site_settings enable row level security;

-- Seed the agreed initial packages and the 12 main categories.
insert into public.packages (name, listing_quota, price_try, duration_days)
values
  ('500 İlan', 500, 949.00, 30),
  ('1000 İlan', 1000, 1249.00, 30)
on conflict (name) do nothing;

insert into public.categories (name, slug, sort_order)
values
  ('Motor', 'motor', 1),
  ('Şanzıman ve Vites', 'sanziman-ve-vites', 2),
  ('Kaporta ve Karoser', 'kaporta-ve-karoser', 3),
  ('Elektrik ve Elektronik', 'elektrik-ve-elektronik', 4),
  ('Ateşleme ve Yakıt', 'atesleme-ve-yakit', 5),
  ('Alt Takım ve Direksiyon', 'alt-takim-ve-direksiyon', 6),
  ('Fren ve Debriyaj', 'fren-ve-debriyaj', 7),
  ('Isıtma, Soğutma ve Klima', 'isitma-sogutma-ve-klima', 8),
  ('Egzoz', 'egzoz', 9),
  ('Filtre', 'filtre', 10),
  ('Mekanik', 'mekanik', 11),
  ('Jant ve Lastik', 'jant-ve-lastik', 12)
on conflict (slug) do nothing;

insert into public.vehicle_types (name, sort_order)
values
  ('Otomobil', 1),
  ('SUV / 4x4', 2),
  ('Hafif Ticari', 3),
  ('Van / Pickup', 4),
  ('Minibüs / Midibüs', 5),
  ('Otobüs', 6),
  ('Kamyon / Ağır Ticari', 7),
  ('Traktör / Tarım', 8),
  ('Elektrikli / Hibrit', 9)
on conflict (name) do nothing;

-- updated_at triggers
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger firms_updated_at before update on public.firms for each row execute function public.set_updated_at();
create trigger packages_updated_at before update on public.packages for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships for each row execute function public.set_updated_at();
create trigger listings_updated_at before update on public.listings for each row execute function public.set_updated_at();
