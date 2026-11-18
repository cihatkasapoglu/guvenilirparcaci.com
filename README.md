# GüvenilirParçacı

Türkiye genelindeki otomotiv yedek parça firmalarının sıfır ve çıkma parça ilanlarını yayınlayabildiği pazar yeri.

## Sayfalar
- `/` – Ana sayfa ve araç markaları
- `/markalar.html` – Araç markaları
- `/ilanlar.html` – Yayındaki ilanları arama ve filtreleme
- `/ilan.html?id=...` – İlan detay sayfası
- `/magaza.html?slug=...` – Firma mağazası ve firmanın ilanları
- `/giris.html` – Firma üyeliği ve giriş
- `/panel.html` – Firma profili, ilan ekleme ve ilan takibi
- `/admin.html` – Firma ve ilan onay yönetimi

## Altyapı
- Ön yüz: HTML, CSS ve JavaScript
- Kimlik doğrulama, veritabanı ve görsel depolama: Supabase
- Veritabanı kurulum dosyası: `supabase/marketplace-schema.sql`
- Kurulum ve ilk yönetici hesabı: `supabase/SETUP.md`

## Firma ve ilan akışı
Firma hesabı açılır, yönetici firma başvurusunu onaylar. Onaylı firma ilanını ve en fazla beş ürün fotoğrafını gönderir. İlanlar yönetici onayından sonra herkese açık olur.

## Korunan mevcut öğeler
Ana sayfa teması, logo, araç marka logoları ve marka sayfaları korunur. Eski sabit firma profilleri yeni platformda kullanılmaz.
