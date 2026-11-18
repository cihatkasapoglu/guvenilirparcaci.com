# Yönetici paneli ve güvenli yönetim API'si

Bu kaynaklar yönetici panelinin arka uç işlemlerini hazırlar. Henüz Supabase'e dağıtılmamış veya canlı test edilmemiştir.

## Yönetici erişimi

Yönetici yetkisi e-posta alanı, kullanıcı metadata'sı veya istemciden gelen bir rol bilgisiyle verilmez. Kullanıcı önce Supabase Auth e-posta doğrulamasını tamamlar. Sonra yetkili operatör, gerçek Auth kullanıcı UUID'sini `public.admin_users` tablosuna ekler. Paneldeki her istek Edge Function içinde bu tabloya karşı tekrar doğrulanır.

İki yönetici için iki ayrı, doğrulanmış Auth kullanıcısı oluşturun. Her ikisinin UUID'sini güvenli şekilde aşağıdaki SQL ile ekleyin (yer tutucuları gerçek UUID ile değiştirin):

```sql
insert into public.admin_users (user_id)
values
  ('FIRST_ADMIN_AUTH_USER_UUID'),
  ('SECOND_ADMIN_AUTH_USER_UUID')
on conflict (user_id) do nothing;
```

Bu SQL'i yalnızca Supabase SQL Editor'da proje sahibi/DB yöneticisi çalıştırmalıdır. Yönetici UUID'lerini veya service role anahtarını tarayıcıya koymayın. İkinci yöneticiyi daha sonra aynı yöntemle ekleyebilirsiniz.

## Yönetim API'si

Endpoint: `/functions/v1/admin-management`

Tüm istekler POST JSON ve `Authorization: Bearer <access token>` gerektirir.

Desteklenen action değerleri:
- `dashboard`: toplam firma/ilan, bekleyen EFT, açık şikâyet, aktif üyelik sayıları.
- `list`: `kind` olarak `firms`, `payments`, `complaints`, `listings`, `packages`, `featured`; `page` ve `pageSize` (en fazla 50).
- `approve_payment` / `reject_payment`: `notificationId`, isteğe bağlı `adminNote`. EFT onayından önce banka hareketi kontrol edilmelidir.
- `update_firm_status`: `firmId`, `status` (`active` veya `suspended`).
- `update_package`: `packageId`, `listingQuota`, `priceTry`, `durationDays`, `isActive`.
- `moderate_complaint`: `complaintId`, `status` (`new`, `reviewing`, `resolved`, `dismissed`), isteğe bağlı `adminNote`.
- `set_featured_settings`: `priceTry`, `durationDays` (1-90 gün).
- `approve_featured` / `reject_featured`: `featuredId`. Onay, yönetici tarafından ödemenin ayrıca doğrulanmasından sonra verilmelidir.
- `admin_logs`: yönetici işlem geçmişi.

## Öne çıkarılan ilanlar

Başlangıç varsayılanı 299 TL / 7 gündür. Yönetici bunu API ile değiştirebilir. Öne çıkarma kayıtlarının oluşturulacağı satıcı ödeme talebi ekranı ayrıca hazırlanmalıdır; bu API mevcut bekleyen kayıtları onaylar/reddeder.

## Dağıtım

Migration sırası 001-007 ve ardından `202611190008_admin_controls.sql` şeklindedir. Sonra:

```bash
supabase functions deploy admin-management
```

Panel arayüzü, gerçek Auth girişine bağlanmalı ve API çağrılarını sadece oturum açmış yönetici kullanıcı için yapmalıdır. Bu dokümandaki örnek UUID'leri gerçek kullanıcı bilgileriyle değiştirin.

## Güvenlik notları

- İki yönetici de tam yetkilidir; yönetici ekleme işlemi yalnızca DB sahibi tarafından yapılır.
- Yönetici işlemleri `admin_logs` tablosuna kaydedilir.
- Service role anahtarı yalnızca Edge Function secret olarak tutulur.
- Paket ve firma değişiklikleri, ödeme onayları ve şikâyet işlemleri istemciden doğrudan tabloya yazılmaz.
