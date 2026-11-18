-- Align admin EFT approval with the pending membership created at payment-notice time.
-- Apply after migration 006. Keeps payment notice and membership lifecycle consistent.

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
  v_starts_at timestamptz := now();
  v_ends_at timestamptz;
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
  where id = v_notice.package_id and is_active;

  if not found then raise exception 'Seçilen paket aktif değil.'; end if;

  v_ends_at := v_starts_at + make_interval(days => v_package.duration_days);

  update public.memberships
     set status = 'expired', updated_at = now()
   where firm_id = v_notice.firm_id and status = 'active';

  if v_notice.membership_id is not null then
    update public.memberships
       set package_id = v_notice.package_id,
           starts_at = v_starts_at,
           ends_at = v_ends_at,
           status = 'active',
           approved_by = auth.uid(),
           updated_at = now()
     where id = v_notice.membership_id
       and firm_id = v_notice.firm_id
       and status = 'pending'
     returning id into v_membership_id;
  end if;

  if v_membership_id is null then
    insert into public.memberships (
      firm_id, package_id, starts_at, ends_at, status, approved_by
    ) values (
      v_notice.firm_id, v_notice.package_id, v_starts_at, v_ends_at, 'active', auth.uid()
    ) returning id into v_membership_id;
  end if;

  update public.payment_notifications
     set status = 'approved',
         reviewed_at = now(),
         reviewed_by = auth.uid(),
         admin_note = p_admin_note,
         membership_id = v_membership_id
   where id = v_notice.id;

  update public.firms set status = 'active', updated_at = now()
   where id = v_notice.firm_id;

  insert into public.admin_logs (admin_user_id, action, target_type, target_id, details)
  values (
    auth.uid(), 'payment_approved', 'payment_notification', v_notice.id::text,
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

  select * into v_notice from public.payment_notifications
  where id = p_notification_id for update;

  if not found or v_notice.status <> 'pending' then
    raise exception 'Onay bekleyen ödeme bildirimi bulunamadı.';
  end if;

  update public.payment_notifications
     set status = 'rejected', reviewed_at = now(),
         reviewed_by = auth.uid(), admin_note = p_admin_note
   where id = v_notice.id;

  if v_notice.membership_id is not null then
    update public.memberships set status = 'rejected', updated_at = now()
     where id = v_notice.membership_id
       and firm_id = v_notice.firm_id and status = 'pending';
  end if;

  insert into public.admin_logs (admin_user_id, action, target_type, target_id, details)
  values (
    auth.uid(), 'payment_rejected', 'payment_notification', v_notice.id::text,
    jsonb_build_object('firm_id', v_notice.firm_id, 'admin_note', p_admin_note)
  );
end;
$$;
