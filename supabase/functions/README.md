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
- Add firm registration and EFT payment-notification workflows.
- Add rate limits and abuse monitoring for upload URL creation.
- Do not expose the R2 S3 endpoint or secret credentials in browser code.
