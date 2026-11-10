-- GüvenilirParçacı günlük ziyaret sayacı
-- Supabase Dashboard > SQL Editor bölümünde bu dosyanın tamamını çalıştırın.

create table if not exists public.daily_visits (
  visit_date date primary key,
  visit_count bigint not null default 0 check (visit_count >= 0)
);

alter table public.daily_visits enable row level security;
revoke all on table public.daily_visits from anon, authenticated;

create or replace function public.increment_daily_visits()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total bigint;
begin
  insert into public.daily_visits (visit_date, visit_count)
  values ((now() at time zone 'Europe/Istanbul')::date, 1)
  on conflict (visit_date)
  do update set visit_count = public.daily_visits.visit_count + 1
  returning visit_count into new_total;
  return new_total;
end;
$$;

revoke all on function public.increment_daily_visits() from public;
grant execute on function public.increment_daily_visits() to anon, authenticated;
