-- GüvenilirParçacı firma üyelik ve havale/EFT takip sistemi
-- Supabase SQL Editor'de bir kez çalıştırın.

create extension if not exists pgcrypto;

create table if not exists public.gp_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.gp_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.gp_admins where user_id = auth.uid());
$$;

revoke all on function public.gp_is_admin() from public;
grant execute on function public.gp_is_admin() to authenticated;

create table if not exists public.gp_memberships (
  id uuid primary key default gen_random_uuid(),
  firm_id text not null unique,
  firm_name text not null,
  phone text,
  monthly_fee numeric(12,2) not null check (monthly_fee >= 0),
  starts_at date,
  ends_at date,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','active','expired','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gp_membership_payments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.gp_memberships(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  method text not null default 'bank_transfer',
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.gp_billing_settings (
  id boolean primary key default true check (id = true),
  iban text not null default '',
  account_holder text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.gp_billing_settings(id) values (true) on conflict (id) do nothing;

alter table public.gp_admins enable row level security;
alter table public.gp_memberships enable row level security;
alter table public.gp_membership_payments enable row level security;
alter table public.gp_billing_settings enable row level security;

revoke all on public.gp_admins from anon, authenticated;
grant select, insert, update, delete on public.gp_memberships to authenticated;
grant select, insert, update, delete on public.gp_membership_payments to authenticated;
grant select, insert, update on public.gp_billing_settings to authenticated;

drop policy if exists "gp admins manage memberships" on public.gp_memberships;
create policy "gp admins manage memberships" on public.gp_memberships
for all to authenticated using (public.gp_is_admin()) with check (public.gp_is_admin());

drop policy if exists "gp admins manage payments" on public.gp_membership_payments;
create policy "gp admins manage payments" on public.gp_membership_payments
for all to authenticated using (public.gp_is_admin()) with check (public.gp_is_admin());

drop policy if exists "gp admins manage billing settings" on public.gp_billing_settings;
create policy "gp admins manage billing settings" on public.gp_billing_settings
for all to authenticated using (public.gp_is_admin()) with check (public.gp_is_admin());


-- Public profile visibility check: exposes only firm ID and active/inactive state.
create or replace function public.gp_public_membership_status()
returns table (firm_id text, active boolean)
language sql
stable
security definer
set search_path = public
as $
  select m.firm_id,
         (m.status = 'active' and m.ends_at is not null and m.ends_at >= current_date) as active
  from public.gp_memberships m;
$;
revoke all on function public.gp_public_membership_status() from public;
grant execute on function public.gp_public_membership_status() to anon, authenticated;

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

  v_base_date := greatest(coalesce(v_membership.ends_at, current_date), current_date);
  v_new_end := (v_base_date + interval '1 month')::date;

  update public.gp_membership_payments
  set status = 'paid', paid_at = now()
  where id = p_payment_id;

  update public.gp_memberships
  set starts_at = coalesce(starts_at, current_date),
      ends_at = v_new_end,
      status = 'active',
      updated_at = now()
  where id = v_membership.id;

  return v_new_end;
end;
$$;

revoke all on function public.gp_approve_membership_payment(uuid) from public;
grant execute on function public.gp_approve_membership_payment(uuid) to authenticated;

-- Yönetici hesabı oluşturma:
-- 1) Yönetim ekranından kendi e-posta adresinizle Supabase Auth hesabı açın.
-- 2) Supabase > Authentication > Users bölümünden kullanıcı UUID'sini bulun.
-- 3) Aşağıdaki satırdaki e-posta adresini kendi adresinizle değiştirip SQL Editor'de çalıştırın:
-- insert into public.gp_admins(user_id)
-- select id from auth.users where email = 'SIZIN_EPOSTANIZ';
