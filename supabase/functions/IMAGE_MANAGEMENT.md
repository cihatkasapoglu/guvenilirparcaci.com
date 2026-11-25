# Fotoğraf yönetimi

Güvenilir Parçacı görselleri Supabase Storage üzerinde saklar. Cloudflare R2 entegrasyonu kullanılmamaktadır.

## Bucket yapısı

- `site-images`: Yayındaki ilan fotoğrafları ve firma görselleri. Herkese açık okuma için kullanılır.
- `site-images-drafts`: Yayınlanmamış ilan fotoğrafları. Özel bucket olarak tutulur.

## İlan fotoğraf akışı

1. Firma paneli yeni fotoğrafları `site-images-drafts` bucket'ına `drafts/{listingId}/{uuid}.{ext}` anahtarıyla yükler.
2. Fotoğraf kaydı `public.listing_images` tablosunda tutulur. Veritabanı uyumluluğu nedeniyle anahtar sütununun adı şimdilik `r2_object_key` olarak kalmıştır; bu sütun adı aktif R2 kullanıldığı anlamına gelmez.
3. İlan yayınlanırken `manage-listing` fotoğrafları `site-images` bucket'ına `listings/{listingId}/{uuid}.{ext}` anahtarıyla taşır.
4. İlan yayından kaldırılırken fotoğraflar tekrar özel taslak bucket'ına taşınır.
5. Fotoğraf ve ilan silme işlemleri ilgili Supabase Storage nesnelerini ve veritabanı kayıtlarını yönetir.

## Dağıtım

```bash
supabase functions deploy manage-listing
```

Gerekli sunucu değişkenleri Supabase'in standart `SUPABASE_URL`, `SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` değerleridir. Service-role anahtarı hiçbir zaman tarayıcıya veya Git deposuna eklenmemelidir.

## Güvenlik

- Taslak bucket özel kalmalıdır.
- Yayındaki görseller `site-images` bucket'ından sunulur.
- Fotoğraf işlemlerinde ilan sahipliği Edge Function içinde doğrulanır.
- Veritabanındaki `r2_object_key` alanı ayrı bir migration planlanmadan yeniden adlandırılmamalıdır.
