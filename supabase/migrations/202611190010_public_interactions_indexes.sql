-- Public interactions: lookup indexes for per-listing view totals and complaint throttling.
-- Apply after 202611180001_initial_schema.sql.
create index if not exists listing_views_listing_id_idx
  on public.listing_views (listing_id);
create index if not exists complaints_listing_email_created_idx
  on public.complaints (listing_id, email, created_at desc);
