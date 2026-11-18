# Supabase kurulumu – GüvenilirParçacı

Bu proje Supabase projesine bağlanacak şekilde hazırlanmıştır. Şu anki SQL dosyası eski tabloları ve eski firma kayıtlarını silmez.

## 1. İlan platformu tabloları
1. Supabase Dashboard'a girin ve GüvenilirParçacı projesini açın.
2. Sol menüden SQL Editor > New query seçin.
3. Bu depodaki `supabase/marketplace-schema.sql` dosyasının tamamını kopyalayıp çalıştırın.
4. Başarılı mesajını gördükten sonra Authentication > Providers bölümünde Email sağlayıcısının açık olduğunu kontrol edin.

## 2. İlk yönetici hesabı
1. Önce `/giris.html` üzerinden kendi yönetici e-posta adresinizle normal firma hesabı oluşturun.
2. Supabase Dashboard > SQL Editor'da aşağıdaki sorguyu çalıştırın. E-posta adresini kendi hesabınızın e-posta adresiyle değiştirin:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'YONETICI_EPOSTA_ADRESI';
```

3. Çıkış yapıp tekrar giriş yapın. Yönetici paneli `/admin.html` adresindedir.

## 3. Firma ve ilan akışı
- Firma üyeliği e-posta ve şifre ile oluşturulur.
- Yeni firma hesabı varsayılan olarak onay bekler.
- Yönetici firma başvurusunu onaylar.
- Onaylı firma panelinden en fazla 5 fotoğraflı ilan gönderir.
- İlanlar varsayılan olarak onay bekler.
- Yönetici ilanı yayına aldığında ilanlar genel aramada ve marka sayfasında görünür.

## Güvenlik notları
- Tarayıcıda yalnızca Supabase publishable/anon anahtarı kullanılır. Service role anahtarı asla site koduna eklenmez.
- Firma ve ilan onay durumları normal firma hesabı tarafından değiştirilemez.
- Fotoğraf yüklemeleri kullanıcı kimliğine ait klasöre sınırlandırılmıştır.
- Bu SQL eski üyelik tablolarını, firma kayıtlarını veya ödeme kayıtlarını silmez. Eski verilerin silinmesi ayrı ve açık bir veritabanı kararıdır.
