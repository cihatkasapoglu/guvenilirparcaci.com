-- Ödeme onayını güvenli biçimde geri alma
-- Supabase SQL Editor'de bir kez çalıştırın.

alter table public.gp_membership_payments
  add column if not exists previous_starts_at date,
  add column if not exists previous_ends_at date,
  add column if not exists previous_membership_status text,
  add column if not exists applied_starts_at date,
  add column if not exists applied_ends_at date;

create or replace function public.gp_approve_membership_payment(p_payment_id uuid)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.gp_membership_payments%rowtype;
  v_membership public.gp_memberships%rowtype;
  v_base_date date;
  v_new_end date;
  v_start_date date;
begin
  if not public.gp_is_admin() then raise exception 'Bu işlem için yönetici yetkisi gerekiyor.'; end if;
  select * into v_payment from public.gp_membership_payments where id = p_payment_id for update;
  if not found then raise exception 'Ödeme kaydı bulunamadı.'; end if;
  if v_payment.status <> 'pending' then raise exception 'Bu ödeme daha önce işlenmiş.'; end if;
  select * into v_membership from public.gp_memberships where id = v_payment.membership_id for update;
  if not found then raise exception 'Üyelik kaydı bulunamadı.'; end if;

  if v_membership.status = 'active' and v_membership.ends_at is not null and v_membership.ends_at >= current_date then
    v_start_date := coalesce(v_membership.starts_at, current_date);
    v_base_date := v_membership.ends_at;
  else
    v_start_date := current_date;
    v_base_date := current_date;
  end if;
  v_new_end := (v_base_date + interval '1 month')::date;

  update public.gp_membership_payments
  set previous_starts_at = v_membership.starts_at,
      previous_ends_at = v_membership.ends_at,
      previous_membership_status = v_membership.status,
      applied_starts_at = v_start_date,
      applied_ends_at = v_new_end,
      status = 'paid',
      paid_at = now()
  where id = p_payment_id;

  update public.gp_memberships
  set starts_at = v_start_date, ends_at = v_new_end, status = 'active', updated_at = now()
  where id = v_membership.id;
  return v_new_end;
end;
$$;

create or replace function public.gp_revert_membership_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.gp_membership_payments%rowtype;
  v_membership public.gp_memberships%rowtype;
begin
  if not public.gp_is_admin() then raise exception 'Bu işlem için yönetici yetkisi gerekiyor.'; end if;
  select * into v_payment from public.gp_membership_payments where id = p_payment_id for update;
  if not found then raise exception 'Ödeme kaydı bulunamadı.'; end if;
  if v_payment.status <> 'paid' then raise exception 'Yalnızca onaylanmış ödemeler geri alınabilir.'; end if;
  if v_payment.applied_ends_at is null then
    raise exception 'Bu eski ödeme için geri alma öncesi üyelik bilgisi kaydedilmemiş. Güvenli biçimde geri alınamaz.';
  end if;

  select * into v_membership from public.gp_memberships where id = v_payment.membership_id for update;
  if not found then raise exception 'Üyelik kaydı bulunamadı.'; end if;
  if exists (
    select 1 from public.gp_membership_payments p
    where p.membership_id = v_payment.membership_id
      and p.status = 'paid' and p.paid_at > v_payment.paid_at
  ) then
    raise exception 'Bu ödemeden sonra başka bir ödeme onaylanmış. Önce sonraki ödeme işlemini kontrol et.';
  end if;
  if v_membership.starts_at is distinct from v_payment.applied_starts_at
     or v_membership.ends_at is distinct from v_payment.applied_ends_at
     or v_membership.status is distinct from 'active' then
    raise exception 'Üyelik bilgileri bu ödeme onayından sonra değişmiş. Tarihleri bozmamak için otomatik geri alma durduruldu.';
  end if;

  update public.gp_memberships
  set starts_at = v_payment.previous_starts_at,
      ends_at = v_payment.previous_ends_at,
      status = v_payment.previous_membership_status,
      updated_at = now()
  where id = v_membership.id;
  update public.gp_membership_payments
  set status = 'cancelled', paid_at = null
  where id = p_payment_id;
end;
$$;

revoke all on function public.gp_approve_membership_payment(uuid) from public;
grant execute on function public.gp_approve_membership_payment(uuid) to authenticated;
revoke all on function public.gp_revert_membership_payment(uuid) from public;
grant execute on function public.gp_revert_membership_payment(uuid) to authenticated;
