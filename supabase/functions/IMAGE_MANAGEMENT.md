# Görsel yönetimi Edge Function'ları

Bu klasördeki görsel fonksiyonları henüz canlı Supabase projesine dağıtılmış değildir. Önce yeni Supabase projesi oluşturulmalı, tüm SQL migration dosyaları sırasıyla uygulanmalı ve R2 bucket/secrets yapılandırılmalıdır.

## İlan fotoğrafları

- `r2-create-upload-url`: Kullanıcının doğrulanmış e-postasını, aktif firmasını ve ilan sahipliğini kontrol eder; R2'ye 5 dakika geçerli imzalı yükleme adresi üretir.
- Tarayıcı dosyayı doğrudan R2'ye PUT eder. Dönen `requiredHeaders` başlıkları aynen gönderilmelidir.
- `r2-finalize-upload`: R2 nesnesini HEAD ile kontrol eder; dosya türü, boyutu ve imza metaverisini doğrular; sonra `listing_images` kaydı oluşturur.
- `r2-manage-listing-images`: `delete`, `reorder` ve `set-cover` işlemlerini yapar. Kullanıcı oturumu, e-posta doğrulaması, aktif firma ve ilan sahipliği her istekte yeniden kontrol edilir.

## Firma mağazası görselleri

- `r2-create-firm-upload-url`: `assetType: "logo"` veya `"cover"` için en fazla 5 MB JPG/PNG/WebP yükleme adresi üretir.
- Tarayıcı, dönen `uploadUrl` adresine PUT yaparken `requiredHeaders` alanındaki başlıkları aynen gönderir.
- `r2-finalize-firm-upload`: Yüklenen nesneyi R2 üzerinden doğrular ve firma kaydındaki `logo_object_key` veya `cover_object_key` alanını günceller. Önceki görseli silmeyi dener.

## Gerekli migration

`supabase/migrations/202611190004_image_order_rpc.sql` dosyası, fotoğraf sıralamasını tek veritabanı işlemi içinde güvenli şekilde değiştiren `set_listing_image_order` fonksiyonunu ekler. Bu migration, diğer migration'lardan sonra uygulanmalıdır.

## Dağıtım

Supabase CLI kurulduktan ve proje bağlandıktan sonra:

```bash
supabase functions deploy r2-create-upload-url
supabase functions deploy r2-finalize-upload
supabase functions deploy r2-manage-listing-images
supabase functions deploy r2-create-firm-upload-url
supabase functions deploy r2-finalize-firm-upload
```

Tüm fonksiyonlar için gerekli secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `SITE_ORIGIN` (ör. `https://guvenilirparcaci.com`)

R2 bucket CORS ayarları, tarayıcıdan PUT isteğine izin vermeli ve aşağıdaki başlıkları kabul etmelidir:
- `Content-Type`
- `x-amz-meta-firm-id`
- `x-amz-meta-listing-id`
- `x-amz-meta-asset-type`

## Henüz tamamlanmayanlar

- İlan oluşturma, düzenleme, yayınlama, geri çekme ve silme için güvenli sunucu fonksiyonları.
- Firma kayıt/oluşturma ve EFT ödeme bildirimi akışı.
- Görsel küçültme/thumbnail üretimi, yetim R2 dosyaları için periyodik temizlik ve işlem hız sınırları.
- Gerçek Supabase ve R2 ortamında dağıtım, uçtan uca test ve canlıya alma.
