# GüvenilirParçacı ilan platformu kurulum sırası

Bu dosyalar `marketplace-foundation` dalında hazırlanmıştır. Henüz Supabase projesine uygulanmamıştır. Canlı veritabanına geçmeden önce yedek alın ve mümkünse staging projesinde test edin.

## 1. Supabase SQL Editor'de çalışma sırası

1. `supabase/membership-management.sql`
   - Mevcut üyelik sistemi zaten kuruluysa yeniden çalıştırmak gerekmeyebilir.
   - `gp_is_admin()`, `gp_memberships` ve ödeme tabloları ilan altyapısının ön koşuludur.
2. `supabase/marketplace-foundation.sql`
   - Firma, firma kullanıcıları, ilanlar, fotoğraf kayıtları, raporlar, güvenlik politikaları ve indeksler.
3. `supabase/marketplace-directory-data.sql`
   - Mevcut 28 araç markası, 5 firma, firma-marka ilişkileri ve 19 galeri fotoğraf yolu.
4. `supabase/marketplace-categories.sql`
   - 15 ana kategori ve 89 alt kategori.
5. `supabase/marketplace-storage.sql`
   - İlan fotoğrafları için Storage bucket ve firma bazlı yükleme/silme kuralları.
6. `supabase/marketplace-admin-tools.sql`
   - Yönetici tarafından firma oluşturma, kullanıcı atama, ilan onaylama, ilan sayıları ve süre dolum fonksiyonları.
7. `supabase/marketplace-search.sql`
   - Arama, filtreleme ve sayfalama RPC fonksiyonu.
8. `supabase/marketplace-bulk-tools.sql`
   - Firma ilan sayıları ile fiyat ve stok toplu güncelleme fonksiyonları.

Dosyaları sırayla açıp tamamını SQL Editor'e yapıştırın ve çalıştırın. Bir adım hata verirse sonraki dosyaya geçmeyin; hatayı çözmeden devam etmek bağımlılık sorunlarına yol açabilir.

## 2. İlan süresi dolum zamanlaması

Yönetici onayı verilen ilanlar 90 gün süreyle yayınlanır. Süresi geçen ilanlar herkese açık aramadan otomatik olarak çıkar. İlanın durum alanının da `expired` olarak güncellenmesi için Supabase Dashboard → Database → Extensions bölümünden `pg_cron` etkinleştirildikten sonra SQL Editor'de aşağıdaki zamanlama bir kez oluşturulmalıdır:

```sql
select cron.schedule(
  'gp-expire-listings',
  '0 0 * * *',
  'select public.gp_expire_listings();'
);
```

Zamanlama UTC 00:00'da çalışır (Türkiye saatiyle 03:00). Aynı zamanlama ikinci kez oluşturulmamalıdır.

## 3. Kurulum sonrası kontrol sorguları

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

## 4. Firma hesabı tanımlama

1. Supabase Dashboard → Authentication → URL Configuration bölümünde `https://guvenilirparcaci.com/firma-panel.html` adresini Redirect URLs listesine ekleyin. Şifre yenileme bağlantıları bu sayfaya döner.
2. Supabase Dashboard → Authentication → Users bölümünden firma kullanıcısına ait hesabı oluşturun.
3. Web sitesinde `/yonetim-ilanlar.html` sayfasını yönetici hesabıyla açın.
4. Firma henüz kayıtlı değilse “Yeni firma ekle” bölümünden firma profilini ve araç markalarını oluşturun.
5. Firma kullanıcısı tanımlama bölümünde firmayı, Auth kullanıcısının e-posta adresini ve rolünü seçin.
6. Kullanıcı `/firma-panel.html` adresinden giriş yapabilir.

Kullanıcılar kendilerini başka bir firmaya bağlayamaz. Firma yetkisini yalnızca site yöneticisi verir.

## 5. Test senaryosu

- Önce test amaçlı bir firma kullanıcısı oluşturun.
- Firma panelinden bir ilan ve bir fotoğraf ekleyin.
- İlanın doğrudan yayına çıkmadığını, yönetici kuyruğuna düştüğünü doğrulayın.
- Yönetici panelinden ilanı onaylayın.
- `/ilanlar.html` sayfasında arama yapın ve ilan detayına girin.
- İkinci bir firma kullanıcısıyla ilk firmanın ilanlarını değiştirmeyi deneyin; erişim engellenmelidir.
- İlanı silince Storage fotoğraflarının da kaldırıldığını kontrol edin.
- CSV şablonuyla yeni ilan aktarımı ve mükerrer satır atlama test edildi.
- İlan listesini CSV dışa aktarma ve fiyat/stok toplu güncelleme test edildi.

## 6. Henüz tamamlanmamış işler

- Dinamik ilan sitemap'i ve SEO dostu ilan URL'leri.
- Excel XLSX dosyasını doğrudan içe aktarma (şu an CSV UTF-8 desteklenir).
- Üyelik paketlerine göre ilan limitleri ve otomatik ilan kota yönetimi.
- Şikâyet inceleme ekranı, spam koruması ve hız sınırlaması.
- Fotoğrafların boyutlandırılması, WebP/AVIF dönüşümü ve küçük/büyük görsel varyantları.
- Büyük veri kümeleri için arka plan CSV dışa aktarma (şu an firma panelinde 10.000 ilana kadar tarayıcıdan dışa aktarma yapılır).
- Yedekleme, geri yükleme ve yoğunluk testleri.

## Güvenlik notları

- Tarayıcıdaki Supabase publishable/anon anahtarı gizli anahtar değildir; service-role anahtarı hiçbir zaman HTML veya JavaScript'e konulmamalıdır.
- RLS politikaları ve sütun bazlı veritabanı izinleri erişimin asıl güvenlik sınırıdır. Arayüzde buton gizlemek tek başına güvenlik sayılmaz.
- İlan fotoğraf bucket'ı herkese açık görsel sunumu için tasarlanmıştır. Bu nedenle buraya özel belge, kimlik veya kişisel veri yüklenmemelidir.
- İlan fotoğrafları için sınır: en fazla 10 fotoğraf, her biri en fazla 5 MB; JPEG, PNG, WebP ve AVIF.
- Firma kullanıcıları yalnızca kendi firmalarının ilanlarını yönetebilir. İlanı yayına alma yetkisi yöneticiye aittir.
- Hukuki ve mevzuat uyumu için `supabase/marketplace-launch-checklist.md` dosyasındaki inceleme başlıkları tamamlanmalıdır.

