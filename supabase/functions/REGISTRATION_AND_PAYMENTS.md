# Firma kayıt ve EFT üyelik akışı

Bu akışın Edge Function ve SQL kaynakları hazırlanmıştır; henüz bir Supabase projesine dağıtılmamıştır.

## 1. Supabase Auth ayarı

Supabase Dashboard -> Authentication -> Providers -> Email bölümünde e-posta sağlayıcısı açık olmalıdır. **Confirm email** açık tutulmalıdır. Site URL ve e-posta doğrulama yönlendirme adresleri üretim alan adına göre ayarlanmalıdır.

Kullanıcı arayüzü önce Supabase Auth `signUp` çağrısıyla e-posta/şifre ve `full_name` metadata alanını gönderir. Kullanıcı doğrulama e-postasındaki bağlantıya tıklar. Doğrulama sonrası giriş yapar ve `complete-firm-registration` fonksiyonuna firma bilgilerini gönderir. Fonksiyon doğrulanmış oturum olmadan firma oluşturmaz. E-posta adresi istek gövdesinden alınmaz; doğrulanmış Auth kullanıcısından okunur.

## 2. Firma kayıt fonksiyonu

Endpoint: `/functions/v1/complete-firm-registration`

POST JSON alanları:
- `name`
- `contactName`
- `phone`
- `whatsapp`
- `taxOrIdentityNumber` (10 veya 11 rakam)
- `province`
- `district`
- `address`
- `description` (isteğe bağlı)

Authorization: `Bearer <supabase access token>`

Firma, doğrulanmış e-posta ile ilişkilendirilir. Vergi/T.C. kimlik numarası sadece firma sahibinin ve yetkili yöneticilerin erişebileceği özel `firms` kaydında tutulur; herkese açık mağaza görünümüne eklenmez. Aynı kullanıcı ikinci firma kaydını oluşturamaz. Firma kaydı tek başına ilan yayınlama hakkı vermez.

## 3. Paketleri gösterme

Paketleri `packages` tablosundan yalnızca aktif kayıtları okuyarak gösterin. Başlangıç paketleri:
- 500 İlan: 949 TL / 30 gün
- 1.000 İlan: 1.249 TL / 30 gün

Fiyat ve kota kod içine sabitlenmemelidir; yönetici paket tablosundan değiştirebilir.

## 4. EFT bildirim fonksiyonu

Endpoint: `/functions/v1/submit-payment-notice`

POST JSON:
- `packageId` (aktif paket ID)
- `senderName` (havale/EFT gönderen adı)
- `amount` (gönderilen tutar)

Authorization: `Bearer <supabase access token>`

Kullanıcıdan dekont yüklemesi istenmez. Bildirim zamanı ve paket ilişkisi sunucu/veritabanı tarafından kaydedilir. Aynı firmada bekleyen bildirim varken ikinci bildirim kabul edilmez. Bildirim ve bekleyen üyelik kaydı tek SQL işlemiyle oluşturulur. Kullanıcının girdiği tutar, yönetici tarafından banka hareketiyle karşılaştırılmalıdır; fonksiyon banka ödemesini doğrulamaz.

## 5. Yönetici onayı

Yönetici, banka hesabındaki transferi kontrol ettikten sonra `approve_payment_notification` RPC'sini çağırır. Onay, bildirimle ilişkili bekleyen üyeliği aktif eder ve paket süresi kadar başlangıç/bitiş tarihlerini belirler. Reddetme işlemi bekleyen üyeliği de reddedilmiş duruma getirir. Yönetici fonksiyonları `admin_users` tablosunda önceden güvenli şekilde yetkilendirilmiş hesaplarla kullanılmalıdır.

## 6. Dağıtım sırası

Önce SQL migration dosyalarını 001, 002, 003, 004, 005, 006 ve 007 sırasıyla uygulayın. Sonra aşağıdaki Edge Functions dağıtılmalıdır:
- `complete-firm-registration`
- `submit-payment-notice`

Gerekli sırlar için ana `README.md` içindeki Supabase Edge Function secrets bölümüne bakın. `SUPABASE_SERVICE_ROLE_KEY` asla tarayıcıya veya GitHub kaynak koduna konulmaz.

## 7. Henüz yapılmayanlar

- Site arayüzündeki kayıt, doğrulama sonrası dönüş ve paket seçimi ekranlarının bu endpoint'lere bağlanması.
- Supabase projesinin oluşturulması, Auth e-posta şablonu/redirect ayarı ve fonksiyonların dağıtılması.
- İki yönetici hesabının gerçek e-posta adresleriyle güvenli biçimde yetkilendirilmesi.
- Gerçek EFT, onay, ret ve üyelik süresi senaryolarının canlı ortamda test edilmesi.
