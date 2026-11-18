-- Admin controls for featured listing pricing and duration.
-- Admin Edge Function performs authorization before using the service role.

insert into public.site_settings (setting_key, setting_value)
values
  ('featured_price', '299'::jsonb),
  ('featured_duration_days', '7'::jsonb)
on conflict (setting_key) do nothing;

create or replace function public.admin_update_featured_settings(
  p_price_try numeric,
  p_duration_days integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu işlem yalnızca yöneticiler tarafından yapılabilir.';
  end if;
  if p_price_try is null or p_price_try < 0 or p_price_try > 10000000 then
    raise exception 'Öne çıkarma ücreti geçersiz.';
  end if;
  if p_duration_days is null or p_duration_days not between 1 and 90 then
    raise exception 'Öne çıkarma süresi 1-90 gün arasında olmalıdır.';
  end if;

  insert into public.site_settings (setting_key, setting_value, updated_by)
  values ('featured_price', to_jsonb(p_price_try), auth.uid())
  on conflict (setting_key) do update
    set setting_value = excluded.setting_value,
        updated_at = now(), updated_by = auth.uid();

  insert into public.site_settings (setting_key, setting_value, updated_by)
  values ('featured_duration_days', to_jsonb(p_duration_days), auth.uid())
  on conflict (setting_key) do update
    set setting_value = excluded.setting_value,
        updated_at = now(), updated_by = auth.uid();

  insert into public.admin_logs (admin_user_id, action, target_type, details)
  values (auth.uid(), 'featured_settings_updated', 'site_settings',
    jsonb_build_object('price_try', p_price_try, 'duration_days', p_duration_days));
end;
$$;

revoke all on function public.admin_update_featured_settings(numeric, integer)
  from public, anon;
grant execute on function public.admin_update_featured_settings(numeric, integer)
  to authenticated;
