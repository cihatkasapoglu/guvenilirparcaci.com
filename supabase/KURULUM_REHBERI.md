# Güvenilir Parçacı — Supabase kurulum rehberi

Bu rehber kaynak kodun yeni bir Supabase projesine aktarılması içindir. **Henüz proje oluşturulmadı; hiçbir SQL veya Edge Function canlıya uygulanmış değildir.** Bu adımları yalnızca doğru Supabase projesi oluşturulduktan sonra izleyin.

## 1. Supabase projesini oluşturma

1. Supabase hesabında yeni bir proje oluşturun.
2. Proje adı: `guvenilirparcaci`.
3. Bölge olarak Türkiye'ye ve hedef ziyaretçilere uygun, gecikmesi düşük bir Avrupa bölgesi seçin.
4. Güçlü ve benzersiz veritabanı parolası belirleyin; parola yöneticisinde saklayın.
5. Proje hazır olunca Project URL, Project Reference ID ve Publishable/anon key değerlerini alın.
6. **Secret/service_role key yalnızca sunucu tarafında kalmalıdır.** GitHub'a, HTML dosyalarına veya tarayıcıya kesinlikle koymayın.

## 2. Veritabanı migration sırası

Yeni ve boş projede Supabase SQL Editor veya Supabase CLI ile aşağıdaki migration dosyalarını sırayla uygulayın:

1. `202611180001_initial_schema.sql` — tablolar, kataloglar, paketler ve temel şema
2. `202611180002_access_policies.sql` — RLS ve erişim kuralları
3. `202611180003_marketplace_workflows.sql` — ilan süresi, yenileme ve günlük haklar
4. `202611190004_image_order_rpc.sql` — fotoğraf sıralama altyapısının ilk sürümü
5. `202611190005_listing_workflows.sql` — güvenli ilan kaydetme ve yayınlama işlemleri
6. `202611190006_membership_payment_workflow.sql` — EFT bildirimi ve bekleyen üyelik
7. `202611190007_payment_approval_alignment.sql` — EFT onay/ret ve üyelik eşleştirmesi
8. `202611190008_admin_controls.sql` — öne çıkarma ayarları
9. `202611190009_listing_image_management.sql` — fotoğraf sıralama/yönetim son hali
10. `202611190010_public_interactions_indexes.sql` — görüntülenme ve şikâyet sorgu indeksleri

Aynı migration'ı tekrar tekrar elle çalıştırmayın. CLI kullanılıyorsa migration geçmişini CLI yönetsin. SQL Editor ile uygulanacaksa her dosyayı bir kez, sırayla çalıştırın ve başarılı sonucu kontrol edin. Hata olursa sonraki dosyaya geçmeyin.

### Supabase CLI ile alternatif kurulum

Bilgisayarda Supabase CLI kurulu ve Git deposu indirilmiş olmalıdır. Proje kök klasöründe:

```bash
supabase login
supabase link --project-ref GERCEK_PROJECT_REF
supabase db push
```

`db push` öncesi doğru projeye bağlı olduğunuzu kontrol edin. Bu komut veritabanı değişikliği yapar; mevcut/üretim veritabanında körlemesine çalıştırmayın.

## 3. E-posta doğrulama ayarları

Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://guvenilirparcaci.com`
- Redirect URL listesine kullanılan doğrulama dönüş adreslerini ekleyin.
- Email sağlayıcısı açık olmalı.
- Confirm email açık olmalı.
- Gerçek kullanıcı kayıtları başlamadan e-posta gönderim limitlerini ve SMTP ayarlarını kontrol edin.

SMS doğrulaması kullanılmayacaktır. Firma kaydı doğrulanmış e-posta gerektirir.

## 4. Edge Function gizli değişkenleri

Supabase Dashboard → Project Settings → Edge Functions → Secrets bölümünde sunucu sırlarını tanımlayın:

- `SUPABASE_URL` — projenin URL'si
- `SUPABASE_ANON_KEY` — publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY` — yalnızca Edge Functions içinde
- `SITE_ORIGIN` — `https://guvenilirparcaci.com`
- `R2_ACCOUNT_ID` — Cloudflare hesap kimliği
- `R2_ACCESS_KEY_ID` — yalnızca hedef Storage bucket için yetkili erişim anahtarı
- `R2_SECRET_ACCESS_KEY` — aynı token'ın gizli anahtarı
- `R2_BUCKET_NAME` — oluşturulan bucket adı

R2 henüz oluşturulmadıysa R2 değişkenlerini tahmin ederek girmeyin. Gerçek değerler Cloudflare'dan alınmalıdır. Service-role ve Storage secret değerleri istemci koduna yazılmaz.

## 5. Supabase Storage hazırlığı

Supabase Storage içinde `site-images` ve `site-images-drafts` bucket’larını oluşturun. `site-images` herkese açık ilan ve firma görselleri içindir. `site-images-drafts` yayınlanmamış ilan fotoğrafları için özel bucket olarak tutulur. Firma paneli fotoğrafları Supabase Storage’a yükler; yayınlama ve yayından kaldırma işlemlerini `manage-listing` Edge Function yürütür.

## 6. Edge Function dağıtımı

Migration'lar ve gerekli secret değerleri hazır olduktan sonra depo kök klasöründe:

```bash
supabase functions deploy complete-firm-registration
supabase functions deploy submit-payment-notice
supabase functions deploy manage-listing
supabase functions deploy admin-management
supabase functions deploy public-interactions
supabase functions deploy public-sitemap
```

`public-interactions` ve `public-sitemap` fonksiyonları `supabase/config.toml` içinde JWT doğrulaması kapalı olacak şekilde tanımlıdır; bu fonksiyonlar kendi erişim/doğrulama mantıklarını uygular. Diğer fonksiyonların oturum doğrulamasını devre dışı bırakmayın.

## 7. İki yönetici hesabı

1. İki yönetici için ayrı Auth kullanıcıları oluşturun.
2. Her iki kullanıcı da e-posta doğrulamasını tamamlasın.
3. Auth kullanıcılarının gerçek UUID değerlerini Supabase Dashboard → Authentication → Users bölümünden alın.
4. Yalnızca proje sahibi/DB yöneticisi, `supabase/functions/ADMIN_PANEL.md` içindeki SQL ile bu iki UUID'yi `public.admin_users` tablosuna eklesin.
5. Yönetici panelinde yalnızca Project URL ve publishable/anon key kullanın. Service-role key eklemeyin.

## 8. Ön yüz ayarları

Aşağıdaki dosyalarda yer tutucular, gerçek Supabase Project URL ve publishable/anon key ile değiştirilmelidir:

- `admin-panel/index.html`
- `seller-panel/index.html`
- `seller-panel/kayit.html`
- `marketplace/index.html`
- `marketplace/ilan.html`
- `marketplace/firma.html`
- `marketplace/kategoriler.html`
- `marketplace/kategori.html`
- `marketplace/markalar.html`
- `marketplace/marka.html`
- `marketplace/model.html`
- `marketplace/favorilerim.html`

Görseller Supabase Storage üzerinden sunulur; ön yüzde ayrıca bir Supabase Storage görsel adresi tanımlanmaz. Service-role veya Storage secret anahtarını bu dosyalara eklemeyin.

## 9. Zamanlanmış işler

İlan süresi dolan kayıtların otomatik olarak `expired` durumuna alınması için `expire_due_listings()` fonksiyonunun güvenli bir sunucu zamanlayıcısıyla düzenli çalıştırılması gerekir. Supabase projesinde pg_cron etkinleştirilmeden ve fonksiyon izinleri kontrol edilmeden cron SQL'i çalıştırmayın. Günlük zamanlama Türkiye saat dilimi dikkate alınarak kurulmalıdır.

## 10. Canlıya geçmeden önce zorunlu kontroller

- [ ] Migration'ların tamamı hatasız uygulandı.
- [ ] RLS açık; anon kullanıcı firma vergi/kimlik bilgilerini okuyamıyor.
- [ ] E-posta doğrulaması ve yönlendirme bağlantısı çalışıyor.
- [ ] Firma kaydı doğrulanmamış kullanıcıyı reddediyor.
- [ ] EFT bildirimi yönetici onayı olmadan üyeliği etkinleştirmiyor.
- [ ] İki yönetici dışında yönetim API'sine erişilemiyor.
- [ ] Satıcı yalnızca kendi firma ve ilanlarını yönetebiliyor.
- [ ] İlan kotası, 30 günlük süre ve günlük 10 yenileme sınırı doğru çalışıyor.
- [ ] Supabase Storage yükleme, 5 fotoğraf sınırı, sıralama ve silme doğrulandı.
- [ ] Şikâyet, favori ve görüntülenme akışları doğrulandı.
- [ ] Süresi dolmuş/üyeliği bitmiş ilanlar herkese açık görünmüyor.
- [ ] Yedekleme, geri yükleme ve hata izleme planı hazır.
- [ ] İletişim ve yasal metinler işletmeci bilgileriyle tamamlandı ve hukuk kontrolünden geçti.

**Önemli:** Kaynak kodun bulunması, SQL'in başarıyla çalıştığı veya fonksiyonların dağıtıldığı anlamına gelmez. İlk gerçek Supabase projesi açıldığında önce boş projede migration'lar uygulanmalı; ardından test hesaplarıyla doğrulama yapılmalıdır.
