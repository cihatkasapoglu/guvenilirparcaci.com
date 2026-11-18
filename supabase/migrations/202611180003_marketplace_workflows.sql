-- Güvenilir Parçacı - trusted workflow functions
-- Apply after migrations 001 and 002.
-- Schedule expire_due_listings() with Supabase Cron after enabling pg_cron in the project.

create or replace function public.expire_due_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.listings
     set status = 'expired',
         updated_at = now()
   where status = 'published'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_due_listings() from public, anon, authenticated;
grant execute on function public.expire_due_listings() to service_role;

-- A seller can use one of the ten daily refresh actions to bump an active listing
-- or republish an expired listing. The operation is serialized per firm.
create or replace function public.refresh_listing(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm public.firms%rowtype;
  v_listing public.listings%rowtype;
  v_membership public.memberships%rowtype;
  v_quota integer;
  v_active_count integer;
  v_daily_count integer;
  v_today date := (timezone('Europe/Istanbul', now()))::date;
  v_refresh_type text;
begin
  if auth.uid() is null then
    raise exception 'Giriş yapmanız gerekiyor.';
  end if;

  select * into v_firm
  from public.firms
  where owner_user_id = auth.uid()
    and status = 'active'
  for update;

  if not found then
    raise exception 'Aktif firma kaydı bulunamadı.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_firm.id::text, 0));

  select * into v_membership
  from public.memberships
  where firm_id = v_firm.id
    and status = 'active'
    and starts_at <= now()
    and ends_at > now()
  order by ends_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Aktif üyeliğiniz bulunmuyor.';
  end if;

  select p.listing_quota into v_quota
  from public.packages p
  where p.id = v_membership.package_id
    and p.is_active;

  if v_quota is null then
    raise exception 'Üyelik paketiniz kullanılamıyor.';
  end if;

  select * into v_listing
  from public.listings
  where id = p_listing_id
    and firm_id = v_firm.id
  for update;

  if not found then
    raise exception 'İlan bulunamadı veya bu ilan size ait değil.';
  end if;

  if v_listing.status = 'published' and v_listing.expires_at <= now() then
    update public.listings
       set status = 'expired', updated_at = now()
     where id = v_listing.id;
    v_listing.status := 'expired';
  end if;

  if v_listing.status = 'published' then
    v_refresh_type := 'bump';
  elsif v_listing.status = 'expired' then
    v_refresh_type := 'republish';
  else
    raise exception 'Yalnızca yayındaki veya süresi dolmuş ilanlar yenilenebilir.';
  end if;

  select count(*) into v_daily_count
  from public.listing_refreshes
  where firm_id = v_firm.id
    and turkey_day = v_today;

  if v_daily_count >= 10 then
    raise exception 'Günlük 10 ücretsiz yenileme hakkınız doldu.';
  end if;

  if v_refresh_type = 'republish' then
    select count(*) into v_active_count
    from public.listings
    where firm_id = v_firm.id
      and status = 'published'
      and expires_at > now();

    if v_active_count >= v_quota then
      raise exception 'Aktif ilan kotanız dolu. Önce bir ilanı yayından kaldırın veya paketinizi yükseltin.';
    end if;
  end if;

  insert into public.listing_refreshes (firm_id, listing_id, refresh_type, turkey_day)
  values (v_firm.id, v_listing.id, v_refresh_type, v_today);

  update public.listings
     set status = 'published',
         published_at = now(),
         expires_at = now() + interval '30 days',
         updated_at = now()
   where id = v_listing.id;

  return jsonb_build_object(
    'listing_id', v_listing.id,
    'refresh_type', v_refresh_type,
    'daily_used', v_daily_count + 1,
    'daily_remaining', 9 - v_daily_count,
    'expires_at', now() + interval '30 days'
  );
end;
$$;

revoke all on function public.refresh_listing(uuid) from public, anon;
grant execute on function public.refresh_listing(uuid) to authenticated;

-- Firm owners can inspect view records for their own listings in their dashboard.
create policy listing_views_owner_read
on public.listing_views for select to authenticated
using (
  exists (
    select 1
    from public.listings l
    join public.firms f on f.id = l.firm_id
    where l.id = listing_views.listing_id
      and f.owner_user_id = auth.uid()
  )
);

-- Admin-only payment approval. The admin must verify the bank transfer before calling this.
create or replace function public.approve_payment_notification(
  p_notification_id uuid,
  p_admin_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notice public.payment_notifications%rowtype;
  v_package public.packages%rowtype;
  v_membership_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem yalnızca yöneticiler tarafından yapılabilir.';
  end if;

  select * into v_notice
  from public.payment_notifications
  where id = p_notification_id
  for update;

  if not found or v_notice.status <> 'pending' then
    raise exception 'Onay bekleyen ödeme bildirimi bulunamadı.';
  end if;

  select * into v_package
  from public.packages
  where id = v_notice.package_id
    and is_active;

  if not found then
    raise exception 'Seçilen paket aktif değil.';
  end if;

  update public.memberships
     set status = 'expired', updated_at = now()
   where firm_id = v_notice.firm_id
     and status = 'active';

  insert into public.memberships (
    firm_id, package_id, starts_at, ends_at, status, approved_by
  )
  values (
    v_notice.firm_id,
    v_notice.package_id,
    now(),
    now() + make_interval(days => v_package.duration_days),
    'active',
    auth.uid()
  )
  returning id into v_membership_id;

  update public.payment_notifications
     set status = 'approved',
         reviewed_at = now(),
         reviewed_by = auth.uid(),
         admin_note = p_admin_note,
         membership_id = v_membership_id
   where id = v_notice.id;

  update public.firms
     set status = 'active',
         updated_at = now()
   where id = v_notice.firm_id;

  insert into public.admin_logs (
    admin_user_id, action, target_type, target_id, details
  )
  values (
    auth.uid(),
    'payment_approved',
    'payment_notification',
    v_notice.id::text,
    jsonb_build_object(
      'firm_id', v_notice.firm_id,
      'package_id', v_notice.package_id,
      'membership_id', v_membership_id,
      'amount_try', v_notice.amount_try
    )
  );

  return v_membership_id;
end;
$$;

revoke all on function public.approve_payment_notification(uuid, text) from public, anon;
grant execute on function public.approve_payment_notification(uuid, text) to authenticated;

-- Admin-only rejection. It does not alter an existing active membership.
create or replace function public.reject_payment_notification(
  p_notification_id uuid,
  p_admin_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notice public.payment_notifications%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem yalnızca yöneticiler tarafından yapılabilir.';
  end if;

  if nullif(trim(p_admin_note), '') is null then
    raise exception 'Reddetme açıklaması zorunludur.';
  end if;

  select * into v_notice
  from public.payment_notifications
  where id = p_notification_id
  for update;

  if not found or v_notice.status <> 'pending' then
    raise exception 'Onay bekleyen ödeme bildirimi bulunamadı.';
  end if;

  update public.payment_notifications
     set status = 'rejected',
         reviewed_at = now(),
         reviewed_by = auth.uid(),
         admin_note = p_admin_note
   where id = v_notice.id;

  insert into public.admin_logs (
    admin_user_id, action, target_type, target_id, details
  )
  values (
    auth.uid(),
    'payment_rejected',
    'payment_notification',
    v_notice.id::text,
    jsonb_build_object('firm_id', v_notice.firm_id, 'admin_note', p_admin_note)
  );
end;
$$;

revoke all on function public.reject_payment_notification(uuid, text) from public, anon;
grant execute on function public.reject_payment_notification(uuid, text) to authenticated;
