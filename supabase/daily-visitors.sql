-- GüvenilirParçacı günlük sayfa görüntüleme sayacı
-- Her sayfa yüklemesi / yenilemesi bir görüntüleme olarak sayılır.

create table if not exists public.daily_page_views (
  visit_date date primary key,
  view_count bigint not null default 0 check (view_count >= 0)
);

alter table public.daily_page_views enable row level security;
revoke all on table public.daily_page_views from anon, authenticated;

create or replace function public.increment_daily_page_view()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  today_in_turkey date := (now() at time zone 'Europe/Istanbul')::date;
  updated_count bigint;
begin
  insert into public.daily_page_views (visit_date, view_count)
  values (today_in_turkey, 1)
  on conflict (visit_date)
  do update set view_count = public.daily_page_views.view_count + 1
  returning view_count into updated_count;

  return updated_count;
end;
$$;

revoke all on function public.increment_daily_page_view() from public;
grant execute on function public.increment_daily_page_view() to anon, authenticated;
