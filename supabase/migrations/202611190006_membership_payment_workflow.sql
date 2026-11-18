-- Güvenilir Parçacı: atomic EFT membership notification workflow.
-- Apply after migrations 001-005. Only trusted Edge Functions may execute this RPC.

create or replace function public.submit_firm_payment_notice(
  p_firm_id uuid,
  p_package_id bigint,
  p_sender_name text,
  p_amount_try numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_package public.packages%rowtype;
  v_membership_id uuid;
  v_notification_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_firm_id::text, 41));

  if not exists (select 1 from public.firms where id = p_firm_id and status = 'active') then
    raise exception 'Aktif firma kaydı bulunamadı.';
  end if;

  if length(trim(coalesce(p_sender_name, ''))) < 2
     or length(trim(p_sender_name)) > 120 then
    raise exception 'Havale/EFT gönderen adı 2-120 karakter olmalıdır.';
  end if;

  if p_amount_try is null or p_amount_try <= 0 or p_amount_try > 10000000 then
    raise exception 'Ödeme tutarı geçersiz.';
  end if;

  select * into v_package
  from public.packages
  where id = p_package_id and is_active
  for share;

  if not found then
    raise exception 'Seçilen üyelik paketi kullanıma açık değil.';
  end if;

  if exists (
    select 1 from public.payment_notifications pn
    where pn.firm_id = p_firm_id and pn.status = 'pending'
  ) then
    raise exception 'Bekleyen bir ödeme bildiriminiz zaten var. Yönetici incelemesini bekleyin.';
  end if;

  insert into public.memberships (firm_id, package_id, status)
  values (p_firm_id, p_package_id, 'pending')
  returning id into v_membership_id;

  insert into public.payment_notifications
    (firm_id, package_id, membership_id, sender_name, amount_try, status)
  values
    (p_firm_id, p_package_id, v_membership_id, trim(p_sender_name), p_amount_try, 'pending')
  returning id into v_notification_id;

  return jsonb_build_object(
    'membership_id', v_membership_id,
    'payment_notification_id', v_notification_id,
    'package_name', v_package.name,
    'package_price_try', v_package.price_try,
    'submitted_amount_try', p_amount_try,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.submit_firm_payment_notice(uuid, bigint, text, numeric)
  from public, anon, authenticated;
grant execute on function public.submit_firm_payment_notice(uuid, bigint, text, numeric)
  to service_role;
