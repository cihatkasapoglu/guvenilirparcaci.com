-- Güvenilir Parçacı - RLS and access-control foundation
-- Apply after 202611180001_initial_schema.sql.
-- Writes that publish listings, approve payments, activate memberships, refresh ads,
-- or upload/delete R2 objects must be implemented as trusted server-side functions.

create or replace function public.is_firm_publicly_active(p_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.firms f
    join public.memberships m on m.firm_id = f.id
    where f.id = p_firm_id
      and f.status = 'active'
      and m.status = 'active'
      and m.starts_at <= now()
      and m.ends_at > now()
  );
$$;

create or replace function public.is_listing_publicly_visible(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and l.status = 'published'
      and l.published_at is not null
      and l.expires_at > now()
      and public.is_firm_publicly_active(l.firm_id)
  );
$$;

-- The public directory view deliberately excludes tax/identity numbers and owner IDs.
create or replace view public.public_firm_directory as
select
  f.id,
  f.name,
  f.slug,
  f.phone,
  f.whatsapp,
  f.province,
  f.district,
  f.address,
  f.description,
  f.logo_object_key,
  f.cover_object_key,
  f.created_at
from public.firms f
where f.status = 'active'
  and public.is_firm_publicly_active(f.id);

grant select on public.public_firm_directory to anon, authenticated;

-- Profiles: users can read and edit their own basic profile only.
create policy profiles_select_own
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Admin identities are provisioned out-of-band, never through public registration.
create policy admin_users_select_self
on public.admin_users for select to authenticated
using (user_id = auth.uid());

-- Firms: owners can read their complete private firm record; admins can manage all.
create policy firms_select_owner_or_admin
on public.firms for select to authenticated
using (owner_user_id = auth.uid() or public.is_admin());

create policy firms_update_owner_or_admin
on public.firms for update to authenticated
using (owner_user_id = auth.uid() or public.is_admin())
with check (owner_user_id = auth.uid() or public.is_admin());

-- Public catalogue data.
create policy vehicle_types_public_read
on public.vehicle_types for select to anon, authenticated
using (is_active or public.is_admin());

create policy vehicle_brands_public_read
on public.vehicle_brands for select to anon, authenticated
using (is_active or public.is_admin());

create policy vehicle_models_public_read
on public.vehicle_models for select to anon, authenticated
using (is_active or public.is_admin());

create policy categories_public_read
on public.categories for select to anon, authenticated
using (is_active or public.is_admin());

create policy subcategories_public_read
on public.subcategories for select to anon, authenticated
using (is_active or public.is_admin());

create policy packages_public_read
on public.packages for select to anon, authenticated
using (is_active or public.is_admin());

-- Public listings are visible only while both the ad and its firm's membership are active.
create policy listings_public_read
on public.listings for select to anon, authenticated
using (public.is_listing_publicly_visible(id) or public.is_admin());

create policy listings_owner_read
on public.listings for select to authenticated
using (
  exists (
    select 1 from public.firms f
    where f.id = listings.firm_id and f.owner_user_id = auth.uid()
  )
);

create policy listing_compatibility_public_read
on public.listing_vehicle_compatibilities for select to anon, authenticated
using (public.is_listing_publicly_visible(listing_id) or public.is_admin());

create policy listing_compatibility_owner_read
on public.listing_vehicle_compatibilities for select to authenticated
using (
  exists (
    select 1
    from public.listings l
    join public.firms f on f.id = l.firm_id
    where l.id = listing_vehicle_compatibilities.listing_id
      and f.owner_user_id = auth.uid()
  )
);

create policy listing_images_public_read
on public.listing_images for select to anon, authenticated
using (public.is_listing_publicly_visible(listing_id) or public.is_admin());

create policy listing_images_owner_read
on public.listing_images for select to authenticated
using (
  exists (
    select 1
    from public.listings l
    join public.firms f on f.id = l.firm_id
    where l.id = listing_images.listing_id
      and f.owner_user_id = auth.uid()
  )
);

-- Membership and payment information is private to the owning firm and administrators.
create policy memberships_owner_read
on public.memberships for select to authenticated
using (
  exists (
    select 1 from public.firms f
    where f.id = memberships.firm_id and f.owner_user_id = auth.uid()
  ) or public.is_admin()
);

create policy payment_notifications_owner_read
on public.payment_notifications for select to authenticated
using (
  exists (
    select 1 from public.firms f
    where f.id = payment_notifications.firm_id and f.owner_user_id = auth.uid()
  ) or public.is_admin()
);

-- Firms may submit a payment notice, but cannot approve it or activate membership.
create policy payment_notifications_owner_insert
on public.payment_notifications for insert to authenticated
with check (
  status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and exists (
    select 1 from public.firms f
    where f.id = payment_notifications.firm_id
      and f.owner_user_id = auth.uid()
  )
);

-- Refresh and featured records are read-only to clients.
create policy listing_refreshes_owner_read
on public.listing_refreshes for select to authenticated
using (
  exists (
    select 1 from public.firms f
    where f.id = listing_refreshes.firm_id and f.owner_user_id = auth.uid()
  ) or public.is_admin()
);

create policy featured_listings_public_read
on public.featured_listings for select to anon, authenticated
using (
  status = 'active'
  and payment_status = 'approved'
  and starts_at <= now()
  and ends_at > now()
  and public.is_listing_publicly_visible(listing_id)
);

create policy featured_listings_owner_read
on public.featured_listings for select to authenticated
using (
  exists (
    select 1
    from public.listings l
    join public.firms f on f.id = l.firm_id
    where l.id = featured_listings.listing_id
      and f.owner_user_id = auth.uid()
  ) or public.is_admin()
);

-- Favorites belong to the signed-in buyer. Inactive ads may remain in favorites.
create policy favorites_owner_all
on public.favorites for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- View counters and complaint moderation are server/admin controlled.
create policy listing_views_admin_read
on public.listing_views for select to authenticated
using (public.is_admin());

create policy complaints_admin_read
on public.complaints for select to authenticated
using (public.is_admin());

create policy complaints_public_submit
on public.complaints for insert to anon, authenticated
with check (
  status = 'new'
  and reviewed_by is null
  and reviewed_at is null
  and public.is_listing_publicly_visible(listing_id)
);

create policy admin_logs_admin_read
on public.admin_logs for select to authenticated
using (public.is_admin());

create policy site_settings_public_read
on public.site_settings for select to anon, authenticated
using (setting_key in ('featured_price', 'featured_duration_days', 'public_contact') or public.is_admin());

-- Restrict client-side writes. Trusted Edge Functions use the service role and
-- must independently validate the caller, ownership, membership, quotas and inputs.
revoke insert, update, delete on public.admin_users from anon, authenticated;
revoke insert, update, delete on public.memberships from anon, authenticated;
revoke insert, update, delete on public.listings from anon, authenticated;
revoke insert, update, delete on public.listing_vehicle_compatibilities from anon, authenticated;
revoke insert, update, delete on public.listing_images from anon, authenticated;
revoke insert, update, delete on public.listing_refreshes from anon, authenticated;
revoke insert, update, delete on public.featured_listings from anon, authenticated;
revoke insert, update, delete on public.listing_views from anon, authenticated;
revoke insert, update, delete on public.complaints from authenticated;
revoke update, delete on public.payment_notifications from anon, authenticated;
revoke insert, update, delete on public.admin_logs from anon, authenticated;
revoke insert, update, delete on public.site_settings from anon, authenticated;
revoke insert, update, delete on public.vehicle_types from anon, authenticated;
revoke insert, update, delete on public.vehicle_brands from anon, authenticated;
revoke insert, update, delete on public.vehicle_models from anon, authenticated;
revoke insert, update, delete on public.categories from anon, authenticated;
revoke insert, update, delete on public.subcategories from anon, authenticated;
revoke insert, update, delete on public.packages from anon, authenticated;

-- Allow profile edits only to safe fields; firm owners may update storefront/contact fields,
-- but never ownership, approval status, or tax/identity number through the client API.
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

revoke update on public.firms from authenticated;
grant update (name, contact_name, phone, whatsapp, email, province, district, address, description, logo_object_key, cover_object_key)
on public.firms to authenticated;

grant select on public.profiles, public.firms, public.admin_users,
  public.vehicle_types, public.vehicle_brands, public.vehicle_models,
  public.categories, public.subcategories, public.packages,
  public.memberships, public.payment_notifications, public.listings,
  public.listing_vehicle_compatibilities, public.listing_images,
  public.listing_refreshes, public.featured_listings, public.favorites,
  public.listing_views, public.complaints, public.admin_logs, public.site_settings
to authenticated;

grant select on public.vehicle_types, public.vehicle_brands, public.vehicle_models,
  public.categories, public.subcategories, public.packages,
  public.listings, public.listing_vehicle_compatibilities, public.listing_images
to anon;

grant insert, delete on public.favorites to authenticated;
grant insert on public.payment_notifications to authenticated;
grant insert on public.complaints to anon, authenticated;
