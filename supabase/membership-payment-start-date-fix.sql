-- Üyelik başlangıç tarihini ödeme onay tarihine bağla.
-- Supabase SQL Editor'de çalıştırın.

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
  if not public.gp_is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.';
  end if;

  select * into v_payment
  from public.gp_membership_payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'Ödeme kaydı bulunamadı.'; end if;
  if v_payment.status <> 'pending' then raise exception 'Bu ödeme daha önce işlenmiş.'; end if;

  select * into v_membership
  from public.gp_memberships
  where id = v_payment.membership_id
  for update;

  if not found then raise exception 'Üyelik kaydı bulunamadı.'; end if;

  -- İlk ödeme veya süresi bitmiş üyelik: süre ödeme onaylandığı gün başlar.
  -- Aktif üyelik yenileniyorsa mevcut bitiş tarihinin üzerine bir ay eklenir.
  if v_membership.status = 'active'
     and v_membership.ends_at is not null
     and v_membership.ends_at >= current_date then
    v_start_date := coalesce(v_membership.starts_at, current_date);
    v_base_date := v_membership.ends_at;
  else
    v_start_date := current_date;
    v_base_date := current_date;
  end if;

  v_new_end := (v_base_date + interval '1 month')::date;

  update public.gp_membership_payments
  set status = 'paid', paid_at = now()
  where id = p_payment_id;

  update public.gp_memberships
  set starts_at = v_start_date,
      ends_at = v_new_end,
      status = 'active',
      updated_at = now()
  where id = v_membership.id;

  return v_new_end;
end;
$$;

revoke all on function public.gp_approve_membership_payment(uuid) from public;
grant execute on function public.gp_approve_membership_payment(uuid) to authenticated;

-- Oto Bahtiyar'ın 12.11.2026 tarihinde alınmış mevcut ödemesini
-- onaylı bırakır ve üyelik dönemini 12.11.2026–12.12.2026 olarak düzeltir.
begin;

update public.gp_membership_payments
set status = 'paid',
    paid_at = '2026-11-12 12:00:00+03'
where id = (
  select p.id
  from public.gp_membership_payments p
  join public.gp_memberships m on m.id = p.membership_id
  where m.firm_name = 'Oto Bahtiyar'
  order by p.created_at desc
  limit 1
);

update public.gp_memberships
set starts_at = date '2026-11-12',
    ends_at = date '2026-12-12',
    status = 'active',
    updated_at = now()
where firm_name = 'Oto Bahtiyar';

commit;
