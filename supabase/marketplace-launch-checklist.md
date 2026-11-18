# GüvenilirParçacı marketplace — yayın öncesi kontrol listesi

Bu liste teknik hazırlığı ve yayın öncesi doğrulamaları ayırır. Hukuki değerlendirme yerine geçmez.

## Teknik kontrol

- [ ] Supabase veritabanının yedeği alındı ve geri yükleme testi yapıldı.
- [ ] SQL dosyaları önce staging projesinde sırayla uygulandı.
- [ ] RLS testleri en az iki ayrı firma kullanıcısıyla yapıldı.
- [ ] Firma A kullanıcısının Firma B ilanlarını okuyamadığı/değiştiremediği doğrulandı.
- [ ] Normal firma kullanıcısının ilanı doğrudan yayına alamadığı doğrulandı.
- [ ] Yönetici onayı, ret gerekçesi ve yeniden gönderim akışı test edildi.
- [ ] Fotoğraf boyutu, dosya türü ve 10 fotoğraf sınırı test edildi.
- [ ] İlan silindiğinde Storage dosyalarının da silindiği doğrulandı.
- [ ] Arama filtreleri, sayfalama ve mobil görünüm test edildi.
- [ ] Yük ve kötüye kullanım testleri yapıldı.
- [ ] Hata izleme, yedekleme, geri yükleme ve güvenlik uyarıları kuruldu.

## Türkiye'de hukuk ve uyum incelemesi

Yayın öncesinde Türkiye'de elektronik ticaret ve çevrimiçi platformlar konusunda çalışan bir hukukçudan yazılı değerlendirme alınmalıdır. Özellikle şu başlıklar incelenmelidir:

- Platformun faaliyet modelinin 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve ilgili ikincil mevzuat bakımından sınıflandırılması; aracı hizmet sağlayıcı/elektronik ticaret aracı hizmet sağlayıcı yükümlülüklerinin uygulanıp uygulanmadığı.
- ETBİS kayıt ve bildirim yükümlülükleri ile işletmeci kimliği, iletişim ve hizmet sağlayıcı bilgilerinin doğru yayımlanması.
- İlan veren firmaların kimlik ve ticari bilgilerinin doğrulanması; yetkisiz, sahte, çalıntı, taklit veya mevzuata aykırı ürün ilanlarının önlenmesi.
- İlan kaldırma, şikâyet, itiraz, tekrar eden ihlal ve resmi makam taleplerine ilişkin süreçler.
- KVKK kapsamında kullanıcı ve firma yetkilisi verilerinin işlenmesi, saklama süreleri, veri sorumlusu/işleyen rolleri, aydınlatma metni, ilgili kişi başvuruları ve veri güvenliği.
- Çerezler, analitik ve reklam teknolojileri için gerekli izin ve bilgilendirme.
- Ticari elektronik ileti gönderilecekse İYS ve ilgili izin/ret süreçleri.
- Üyelik bedeli, vergi, fatura, reklam/sponsorlu ilan işaretlemesi ve tüketiciye yönelik bilgilendirme yükümlülükleri.
- Mevcut sözleşme ve politika sayfalarındaki işletmeci adı, resmi adres, vergi ve başvuru kanalı gibi köşeli parantezli taslak alanlarının tamamlanması.

## İş modeli açıklığı

- Platform üzerinden ödeme tahsil edilmiyor; alıcı ve satıcı doğrudan görüşüyor.
- Bu durum, platformun mevzuat kapsamındaki diğer yükümlülüklerini kendiliğinden ortadan kaldırdığı şeklinde yorumlanmamalıdır.
- Kullanıcıya gösterilen “doğrulanmış”, “güvenilir”, “garantili” gibi ifadeler somut bir doğrulama sürecine dayandırılmalıdır.
- Sponsorlu yerleşimler açıkça etiketlenmelidir.

## Mevcut dosyalar hakkında

Kullanım Koşulları, Firma Üyelik Sözleşmesi, İçerik Kuralları, Şikâyet Politikası ve Hakkımızda sayfaları yeni ilan modeline göre taslak olarak güncellendi. Hukukçu incelemesi ve işletmeci bilgilerinin tamamlanması olmadan bu metinler nihai hukuki metin olarak kabul edilmemelidir.
