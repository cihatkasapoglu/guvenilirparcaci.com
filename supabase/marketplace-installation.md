# GüvenilirParçacı ilan platformu kurulum sırası

Bu dosyalar `marketplace-foundation` dalında hazırlanmıştır. Henüz Supabase projesine uygulanmamıştır. Canlı veritabanına geçmeden önce mümkünse Supabase staging projesinde test edin ve yedek alın.

## 1. Supabase SQL Editor'de çalışma sırası

1. `supabase/membership-management.sql`
   - Mevcut üyelik sistemi zaten kuruluysa yeniden çalıştırmak gerekmeyebilir.
   - `gp_is_admin()`, `gp_memberships` ve ödeme tabloları ilan altyapısının ön koşuludur.
2. `supabase/marketplace-foundation.sql`
   - Firma, firma kullanıcıları, ilanlar, fotoğraf kayıtları, raporlar ve RLS.
3. `supabase/marketplace-directory-data.sql`
   - Mevcut araç markaları, firma kayıtları, firma-marka ilişkileri ve galeri fotoğraf yolları.
4. `supabase/marketplace-categories.sql`
   - 15 ana kategori ve 89 alt kategori.
5. `supabase/marketplace-storage.sql`
   - İlan fotoğrafları için Storage bucket ve firma bazlı yükleme/silme kuralları.
6. `supabase/marketplace-admin-tools.sql`
   - Yönetici tarafından firma kullanıcısı atama ve ilan onaylama fonksiyonları.
7. `supabase/marketplace-search.sql`
   - Arama, filtreleme ve sayfalama RPC fonksiyonu.
8. `supabase/marketplace-bulk-tools.sql`
   - Firmaların kendi ilanlarında fiyat ve stok bilgilerini toplu güncellemesi.

Dosyaları sırayla açıp tamamını SQL Editor'e yapıştırın ve çalıştırın. Bir adım hata verirse sonraki dosyaya geçmeyin; hatayı çözmeden devam etmek bağımlılık sorunlarına yol açabilir.

## 2. Kurulum sonrası kontrol sorguları

Aşağıdaki sorgular beklenen temel kayıt sayılarını kontrol eder:

```sql
select count(*) as vehicle_brands from public.gp_vehicle_brands;
select count(*) as firms from public.gp_firms;
select count(*) as main_categories
from public.gp_categories where parent_id is null;
select count(*) as sub_categories
from public.gp_categories where parent_id is not null;
select count(*) as firm_gallery_images from public.gp_firm_images;
select count(*) as listings from public.gp_listings;
```

Beklenen ilk aktarım: 28 marka, 5 firma, 15 ana kategori, 89 alt kategori ve 19 firma fotoğraf referansı. İlan sayısı başlangıçta sıfırdır.

## 3. Firma hesabı tanımlama

1. Supabase Dashboard → Authentication → URL Configuration bölümünde `https://guvenilirparcaci.com/firma-panel.html` adresini Redirect URLs listesine ekleyin. Şifre yenileme bağlantıları bu sayfaya döner.
2. Supabase Dashboard → Authentication → Users bölümünden firma kullanıcısına ait hesabı oluşturun.
2. Web sitesinde `/yonetim-ilanlar.html` sayfasını yönetici hesabıyla açın.
3. Firma kullanıcısı tanımlama bölümünde firmayı, Auth kullanıcısının e-posta adresini ve rolünü seçin.
4. Kullanıcı `/firma-panel.html` adresinden giriş yapabilir.

Kullanıcılar kendilerini başka bir firmaya bağlayamaz. Firma yetkisini yalnızca site yöneticisi verir.

## 4. Test senaryosu

- Önce test amaçlı bir firma kullanıcısı oluşturun.
- Firma panelinden bir ilan ve bir fotoğraf ekleyin.
- İlanın doğrudan yayına çıkmadığını, yönetici kuyruğuna düştüğünü doğrulayın.
- Yönetici panelinden ilanı onaylayın.
- `/ilanlar.html` sayfasında arama yapın ve ilan detayına girin.
- İkinci bir firma kullanıcısıyla ilk firmanın ilanlarını değiştirmeyi deneyin; erişim engellenmelidir.
- İlanı silince Storage fotoğraflarının da kaldırıldığını kontrol edin.

## 5. Henüz tamamlanmamış işler

- Mevcut firma profilleri artık veritabanından okunur; `brands.js` yalnızca veritabanı geçişi yapılmamış eski kurulumlar için yedek olarak kalır.
- Dinamik ilan sitemap'i ve SEO dostu ilan URL'leri.
- Excel/CSV toplu ilan aktarımı ve toplu fiyat/stok güncellemesi.
- Üyelik paketlerine göre ilan limitleri ve otomatik ilan süresi yönetimi.
- Şikâyet inceleme ekranı, spam koruması, hız sınırlaması ve denetim kayıtlarının yönetici arayüzü.
- Fotoğrafların boyutlandırılması, WebP/AVIF dönüşümü ve küçük/büyük görsel varyantları.
- Yedekleme, geri yükleme ve yoğunluk testleri.

## Güvenlik notları

- Tarayıcıdaki Supabase publishable/anon anahtarı gizli anahtar değildir; service-role anahtarı hiçbir zaman HTML veya JavaScript'e konulmamalıdır.
- RLS politikaları erişimin asıl güvenlik sınırıdır. Arayüzde buton gizlemek tek başına güvenlik sayılmaz.
- Fotoğraf yükleme politikası dosyayı firma kimliği ve ilan UUID'si altındaki klasöre sınırlar.
- İlan fotoğraf bucket'ı herkese açık görsel sunumu için tasarlanmıştır. Bu nedenle buraya özel belge, kimlik veya kişisel veri yüklenmemelidir.
- Üretim veritabanına uygulamadan önce mevcut veritabanı yedeği alın ve SQL'leri önce test projesinde doğrulayın.
