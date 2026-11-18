-- GüvenilirParçacı ilan platformu başlangıç şeması
-- Bu dosya eski tabloları veya kayıtları silmez. Supabase SQL Editor'da bir kez çalıştırılır.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  phone text not null default '',
  whatsapp text not null default '',
  city text not null default '',
  address text not null default '',
  description text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  brand_id text not null,
  model text not null default '',
  part_name text not null default '',
  part_number text not null default '',
  condition text not null default 'used' check (condition in ('new','used','refurbished')),
  description text not null default '',
  price numeric(12,2),
  currency text not null default 'TRY' check (currency in ('TRY','EUR','USD')),
  city text not null default '',
  images text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','active','rejected','sold')),
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_brand_status_created_idx on public.listings (brand_id, status, created_at desc);
create index if not exists listings_company_created_idx on public.listings (company_id, created_at desc);
create index if not exists listings_search_idx on public.listings using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(part_name,'') || ' ' || coalesce(model,'') || ' ' || coalesce(part_number,'')));

create or replace function public.create_company_for_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare company_name text;
declare company_slug text;
begin
  company_name := coalesce(nullif(new.raw_user_meta_data->>'company_name',''), split_part(new.email,'@',1));
  company_slug := trim(both '-' from regexp_replace(lower(company_name), '[^a-z0-9]+', '-', 'g'));
  if company_slug = '' then company_slug := 'firma'; end if;
  insert into public.companies (id, name, slug, phone, city)
  values (new.id, company_name, company_slug || '-' || substr(new.id::text,1,8),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'city',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_company on auth.users;
create trigger on_auth_user_created_company
after insert on auth.users
for each row execute procedure public.create_company_for_new_user();

alter table public.companies enable row level security;
alter table public.listings enable row level security;

drop policy if exists "Public can view approved companies" on public.companies;
create policy "Public can view approved companies" on public.companies
for select using (status = 'approved' or id = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "Company owners can update own profile" on public.companies;
create policy "Company owners can update own profile" on public.companies
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Public can view active listings" on public.listings;
create policy "Public can view active listings" on public.listings
for select using (
  (status = 'active' and exists (
    select 1 from public.companies c where c.id = listings.company_id and c.status = 'approved'
  ))
  or company_id = auth.uid()
  or (auth.jwt()->'app_metadata'->>'role') = 'admin'
);

drop policy if exists "Approved companies can create listings" on public.listings;
create policy "Approved companies can create listings" on public.listings
for insert with check (
  company_id = auth.uid()
  and exists (select 1 from public.companies c where c.id = auth.uid() and c.status = 'approved')
);

drop policy if exists "Owners can update own listings" on public.listings;
create policy "Owners can update own listings" on public.listings
for update using (company_id = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin')
with check (company_id = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "Owners can delete own listings" on public.listings;
create policy "Owners can delete own listings" on public.listings
for delete using (company_id = auth.uid() or (auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images','listing-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "Public can view listing images" on storage.objects;
create policy "Public can view listing images" on storage.objects
for select using (bucket_id = 'listing-images');

drop policy if exists "Company users upload own listing images" on storage.objects;
create policy "Company users upload own listing images" on storage.objects
for insert to authenticated
with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Company users update own listing images" on storage.objects;
create policy "Company users update own listing images" on storage.objects
for update to authenticated
using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Company users delete own listing images" on storage.objects;
create policy "Company users delete own listing images" on storage.objects
for delete to authenticated
using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

grant select, insert, update, delete on public.listings to authenticated;
grant select, update on public.companies to authenticated;
grant select on public.listings, public.companies to anon;
