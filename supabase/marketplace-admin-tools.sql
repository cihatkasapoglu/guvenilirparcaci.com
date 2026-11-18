-- Admin-only onboarding and moderation operations.
-- Run after marketplace-foundation.sql.

begin;

alter table public.gp_listings add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.gp_listings add column if not exists reviewed_at timestamptz;
alter table public.gp_listings add column if not exists rejection_reason text;

create or replace function public.gp_admin_assign_firm_user(
  p_firm_id text,
  p_user_id uuid,
  p_role text default 'owner'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_id uuid;
begin
  if not public.gp_is_admin() then
    raise exception 'Bu işlem için site yöneticisi yetkisi gerekiyor.';
  end if;

  if p_role not in ('owner','admin','editor','viewer') then
    raise exception 'Geçersiz firma kullanıcı rolü.';
  end if;

  if not exists (select 1 from public.gp_firms f where f.id = p_firm_id) then
    raise exception 'Firma bulunamadı.';
  end if;

  insert into public.gp_firm_users(firm_id,user_id,role)
  values (p_firm_id,p_user_id,p_role)
  on conflict (firm_id,user_id)
  do update set role = excluded.role
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.gp_admin_assign_firm_user(text,uuid,text) from public;
grant execute on function public.gp_admin_assign_firm_user(text,uuid,text) to authenticated;

create or replace function public.gp_admin_assign_firm_user_by_email(
  p_firm_id text,
  p_email text,
  p_role text default 'owner'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
begin
  if not public.gp_is_admin() then
    raise exception 'Bu işlem için site yöneticisi yetkisi gerekiyor.';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'E-posta adresi zorunludur.';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'Bu e-posta ile kayıtlı bir kullanıcı bulunamadı. Önce Supabase Authentication bölümünden kullanıcı hesabını oluşturun.';
  end if;

  return public.gp_admin_assign_firm_user(p_firm_id, v_user_id, p_role);
end;
$function$;

revoke all on function public.gp_admin_assign_firm_user_by_email(text,text,text) from public;
grant execute on function public.gp_admin_assign_firm_user_by_email(text,text,text) to authenticated;

create or replace function public.gp_admin_review_listing(
  p_listing_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if not public.gp_is_admin() then
    raise exception 'Bu işlem için site yöneticisi yetkisi gerekiyor.';
  end if;

  if p_decision not in ('active','rejected','pending') then
    raise exception 'Geçersiz ilan inceleme kararı.';
  end if;

  update public.gp_listings
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_rejection_reason),'') else null end,
      published_at = case
        when p_decision = 'active' then coalesce(published_at, now())
        else published_at
      end,
      expires_at = case
        when p_decision = 'active' then now() + interval '90 days'
        else null
      end,
      updated_at = now()
  where id = p_listing_id;

  if not found then
    raise exception 'İlan bulunamadı.';
  end if;

  return p_listing_id;
end;
$function$;

revoke all on function public.gp_admin_review_listing(uuid,text,text) from public;
grant execute on function public.gp_admin_review_listing(uuid,text,text) to authenticated;

commit;
