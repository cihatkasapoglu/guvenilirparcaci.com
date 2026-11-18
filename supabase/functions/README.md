# Supabase Edge Functions

These functions are prepared for the Güvenilir Parçacı project. They are not deployed yet.

## Required Edge Function secrets

Set these values in Supabase Project Settings -> Edge Functions -> Secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose to the browser)
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `SITE_ORIGIN` (for production: `https://guvenilirparcaci.com`)

Use an R2 API token scoped only to the target bucket, with object read/write permissions required by the upload functions. Do not commit credentials to GitHub.

## R2 bucket CORS

Configure the R2 bucket CORS policy to allow browser uploads from the production site. Example policy:

```json
[
  {
    "AllowedOrigins": ["https://guvenilirparcaci.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": [
      "content-type",
      "x-amz-meta-firm-id",
      "x-amz-meta-listing-id",
      "x-amz-meta-asset-type"
    ],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

If the site later uses `www.guvenilirparcaci.com`, add that exact origin too. Do not use a wildcard origin in production.

## Upload flow

1. The signed-in firm calls `r2-create-upload-url` with `listingId`, `fileName`, `contentType`, and file `size`.
2. The function verifies the Supabase user, confirmed email, firm ownership/status, supported image type, 8 MB limit, and current photo count.
3. The browser uploads the file directly to the signed R2 URL using every header returned in `requiredHeaders`.
4. The browser calls `r2-finalize-upload` with `listingId` and `objectKey`.
5. The finalizer checks the object in R2, verifies its metadata/type/size, checks the five-photo limit again, then inserts the `listing_images` record.

The five-photo limit is checked again at finalization because multiple upload links could be requested concurrently. A database uniqueness conflict rejects a duplicate display order; retry the finalization after refreshing the listing's image list.

## Seller listing workflow

The `manage-listing` Edge Function supports these authenticated actions:

- `create`: creates a draft listing.
- `update`: updates the seller's listing without extending its expiry.
- `publish`: publishes a draft/withdrawn listing for 30 days after checking active membership, quota and 1-5 photos.
- `withdraw`: removes a published listing from public search without deleting it.
- `delete`: deletes the seller's listing and its R2 photos.

For `create` and `update`, send `listing` fields using camelCase keys (`categoryId`, `subcategoryId`, `partType`, `title`, `description`, `fuelType`, `engineCode`, `oemNumber`, `priceType`, `price`) and a `compatibilities` array with `vehicleModelId`, `yearFrom`, and `yearTo`. Each listing must have 1-20 vehicle compatibility entries. Price type is `fixed`, `negotiable`, or `ask`; for `ask`, price is omitted/null. Part type is `new` or `used`.

The SQL migration `202611190005_listing_workflows.sql` creates service-role-only database functions for atomic listing saves and quota-checked publishing. Apply it after migrations 001-004 before deploying this Edge Function.

## Deployment (only after a Supabase project exists)

From the repository root, after installing the Supabase CLI and linking the intended project:

```bash
supabase functions deploy r2-create-upload-url
supabase functions deploy r2-finalize-upload
supabase functions deploy r2-manage-listing-images
supabase functions deploy r2-create-firm-upload-url
supabase functions deploy r2-finalize-firm-upload
supabase functions deploy manage-listing
```

Do not run these commands until the project, bucket, CORS policy, and secrets have been configured.

## Important remaining work

- Add image resizing/thumbnail generation before public display.
- Add scheduled orphan-object cleanup and verify deletion behavior.
- Add rate limits and abuse monitoring for upload URL creation.
- Do not expose the R2 S3 endpoint or secret credentials in browser code.

## Firm registration and EFT membership

See [REGISTRATION_AND_PAYMENTS.md](./REGISTRATION_AND_PAYMENTS.md) for the verified-email firm registration flow, package selection, EFT notification, and admin approval steps.

Deploy these additional functions after migrations 006 and 007:

```bash
supabase functions deploy complete-firm-registration
supabase functions deploy submit-payment-notice
```


## Admin panel

The responsive admin UI source is in `admin-panel/index.html`. Before publishing it, replace the two placeholders in the file with the Supabase Project URL and publishable/anon key. Never put the service-role key in this file.

Apply migration `202611190008_admin_controls.sql` after migrations 001-007, then deploy:

```bash
supabase functions deploy admin-management
```

Provision the two administrator Auth users and insert their UUIDs into `public.admin_users` using the secure SQL instructions in [ADMIN_PANEL.md](./ADMIN_PANEL.md). The panel can then be hosted at a private/noindex route. Authentication and administrator membership are checked by the Edge Function on every request.


## Seller panel

The responsive seller interface is in `seller-panel/index.html`. It includes sign-in/password reset, seller listing management, multi-model compatibility selection, R2 photo upload, publish/withdraw/delete, daily refresh usage, membership/payment notice history, and firm profile editing.

Before hosting, replace `SUPABASE_PROJECT_URL_BURAYA` and `SUPABASE_ANON_KEY_BURAYA` in the file. Do not place the service-role key in browser code. Host this page over HTTPS at a private/noindex route such as `/firma-panel/`.

Deploy the seller functions after the required migrations:

```bash
supabase functions deploy manage-listing
supabase functions deploy r2-create-upload-url
supabase functions deploy r2-finalize-upload
supabase functions deploy r2-create-firm-upload-url
supabase functions deploy r2-finalize-firm-upload
```

The seller panel currently expects the public catalogue tables and owner-read RLS policies from migrations 001-002, listing workflow RPCs from migration 005, and the payment workflow from migrations 006-007. Configure the R2 public image delivery base URL separately before displaying uploaded images on the storefront. Live authentication, database, and upload tests remain pending until Supabase and R2 are provisioned.


### Seller photo management update

Apply `202611190009_listing_image_management.sql` after migrations 001-008. It adds the service-role-only RPC used to safely reorder a seller's own listing photos and set the first photo as the cover. The `manage-listing` Edge Function now supports `delete_image` and `reorder_images`; the seller panel displays thumbnails when `R2_PUBLIC_BASE_URL` is configured and provides move/delete controls. Set that public delivery base URL in the seller panel source before hosting. Never expose R2 credentials in the browser.


## Public marketplace pages

The first public buyer-facing pages are in `marketplace/index.html` (search and filters) and `marketplace/ilan.html` (listing detail and seller contact). They use the Supabase anon/publishable key only and rely on the public listing and firm-directory RLS policies. Before hosting, replace the Supabase URL/key placeholders and `R2_PUBLIC_BASE_URL_BURAYA` with the public R2 custom-domain base URL. Host the files at the intended public routes and configure the listing-detail route/SEO metadata as the site routing is finalized. These pages are source files only; they are not deployed.


## Public firm storefront

The public firm storefront source is `marketplace/firma.html`. It loads a firm by its public slug from `public_firm_directory`, displays the firm's logo/cover, description, address and phone/WhatsApp contact, and lists up to 100 currently published, unexpired listings. Business opening hours are not displayed.

Listing detail pages link to the corresponding storefront. The current static route is:

```
/marketplace/firma.html?slug=firm-slug
```

A clean route such as `/firm-slug` requires a hosting rewrite rule. Configure that only after confirming the production hosting platform, and reserve system paths such as `/marketplace`, `/firma-panel`, and `/admin-panel`. This page is source only and requires the Supabase URL, anon key and R2 public base URL to be configured before deployment.


## Buyer interactions

- `supabase/functions/public-interactions/index.ts` handles public listing view recording and complaint submission. It uses the service role only inside the Edge Function; never expose that key in browser code.
- Deploy the function as `public-interactions`. It needs the standard `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets.
- The endpoint records at most one view per listing, browser visitor identifier and Turkey-local calendar day. The visitor identifier is stored in the browser's local storage; the server stores only a SHA-256 hash combined with a truncated user-agent.
- Complaint submissions validate email, reason and explanation, include a honeypot field and limit repeated complaints for the same listing/email to three per hour.
- Favorites use the existing `favorites` table and authenticated-user RLS policies. Buyers can sign in/register on the listing detail page and review saved ads at `/marketplace/favorilerim.html`.
- Sellers see per-listing view totals in the seller panel. The owner-read policy on `listing_views` is defined in migration `202611180003_marketplace_workflows.sql`.
- Apply `202611190010_public_interactions_indexes.sql` after the initial schema to optimize view and complaint queries.

These are source changes only. Deploy the Edge Function and apply migrations in the Supabase project before enabling the feature in production. Configure email confirmation and redirect URLs in Supabase Auth for buyer registration.


## Clean URLs and SEO

The repository includes two hosting rewrite configurations:

- `_redirects`: for Cloudflare Pages / Netlify-style static hosting.
- `.htaccess`: for Apache hosting with `mod_rewrite`.

Public URL formats:

- Firm storefront: `https://guvenilirparcaci.com/firma-slug`
- Listing detail: `https://guvenilirparcaci.com/ilan/LISTING-UUID/listing-title`

The seller login route `/firma-panel/` is rewritten to `seller-panel/index.html`. Keep the rewrite file that matches the actual hosting platform at the website document root. Do not install both routing systems blindly; Apache uses `.htaccess`, while Cloudflare Pages/Netlify reads `_redirects`.

Listing detail pages now set a canonical URL, a description based on the listing, Open Graph sharing metadata, a social sharing image when available, and Schema.org Product/Offer structured data. Firm storefronts use the firm slug as the canonical URL and publish AutoPartsStore structured data and social metadata. The old query-string detail URLs remain accepted for backward compatibility, but canonical tags point to the clean URLs.

The current `sitemap.xml` lists the main public directory pages. It does not yet enumerate every live listing and firm dynamically. A dynamic sitemap should be connected after the production Supabase project and hosting rewrite/proxy are configured; do not add sample or invented listing URLs to the sitemap. Submit `https://guvenilirparcaci.com/sitemap.xml` in Google Search Console after deployment.


## Dynamic XML sitemap and Google indexing

The Edge Function `public-sitemap` generates an XML sitemap index using the public Supabase role (never the service-role key). Database row-level security controls which published listings are visible; the firm sitemap reads only `public_firm_directory`, which excludes firms without an active public membership.

It creates:
- `/sitemap.xml` — sitemap index
- `/sitemap-static.xml` — the fixed homepage/category/brand directory URLs
- `/sitemap-listings.xml?page=1` — active, published listing URLs in batches of up to 10,000
- `/sitemap-firms.xml?page=1` — publicly visible firm storefront URLs in batches of up to 10,000

The function queries in 1,000-row database batches to stay within common Supabase REST row limits. Sitemap index entries are calculated from exact public row counts. Responses are cacheable for 15 minutes in browsers and one hour at shared caches.

### Deploy

After creating the Supabase project, applying all database migrations, and setting the required function secrets, deploy:

```bash
supabase functions deploy public-sitemap
```

### Connect the public domain

For Cloudflare Pages, add this proxy rule to the root `_redirects` file after replacing `YOUR_PROJECT_REF` with the real Supabase project reference:

```text
/sitemap.xml https://YOUR_PROJECT_REF.supabase.co/functions/v1/public-sitemap 200
/sitemap-listings.xml /functions/v1/public-sitemap?type=listings 200
/sitemap-firms.xml /functions/v1/public-sitemap?type=firms 200
```

The two query-parameter rewrites above are relative to the site and are only suitable if a Pages Function proxy is implemented. For a direct Supabase proxy, use explicit absolute Supabase function URLs with the corresponding `?type=` query string, or implement a Cloudflare Pages Function at `functions/sitemap-listings.xml.ts` and `functions/sitemap-firms.xml.ts`. Do not add these routes before the project reference exists and the function is deployed.

For other hosting providers, configure equivalent reverse-proxy rewrites to the Supabase function. Keep `sitemap-static.xml` as a separate static file. The existing `sitemap.xml` remains a static fallback until the dynamic proxy is enabled.

### Google Search Console

After the domain and dynamic endpoint are live:
1. Verify `guvenilirparcaci.com` in Google Search Console.
2. Open Sitemaps and submit `https://guvenilirparcaci.com/sitemap.xml`.
3. Inspect a sample firm URL and listing URL with URL Inspection.
4. Check indexing and sitemap processing reports for errors.

Do not submit the dynamic sitemap before its proxy is enabled. The source code is prepared but is not deployed, and the current sitemap is not yet dynamically populated.
