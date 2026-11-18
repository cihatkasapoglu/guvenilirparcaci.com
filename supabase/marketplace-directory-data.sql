-- Existing directory data import for GüvenilirParçacı.
-- Run after supabase/marketplace-foundation.sql in Supabase SQL Editor.
-- Safe to re-run: all seed inserts use ON CONFLICT DO NOTHING.

begin;

create table if not exists public.gp_vehicle_brands (
  id text primary key,
  name text not null,
  logo_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.gp_firm_brands (
  firm_id text not null references public.gp_firms(id) on delete cascade,
  brand_id text not null references public.gp_vehicle_brands(id) on delete restrict,
  primary key (firm_id, brand_id)
);

create table if not exists public.gp_firm_images (
  id bigint generated always as identity primary key,
  firm_id text not null references public.gp_firms(id) on delete cascade,
  image_url text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (firm_id, image_url)
);

alter table public.gp_firms add column if not exists phone_secondary text;
alter table public.gp_firms add column if not exists whatsapp_secondary text;
alter table public.gp_firms add column if not exists hours text;
alter table public.gp_firms add column if not exists rating numeric(2,1);
alter table public.gp_firms add column if not exists sponsored boolean not null default false;

create index if not exists gp_firm_brands_brand_idx on public.gp_firm_brands(brand_id, firm_id);
create index if not exists gp_firm_images_firm_idx on public.gp_firm_images(firm_id, sort_order);

alter table public.gp_vehicle_brands enable row level security;
alter table public.gp_firm_brands enable row level security;
alter table public.gp_firm_images enable row level security;

grant select on public.gp_vehicle_brands, public.gp_firm_brands, public.gp_firm_images to anon, authenticated;
grant insert, update, delete on public.gp_vehicle_brands, public.gp_firm_brands, public.gp_firm_images to authenticated;

drop policy if exists gp_vehicle_brands_public_read on public.gp_vehicle_brands;
create policy gp_vehicle_brands_public_read on public.gp_vehicle_brands
for select to anon, authenticated using (is_active = true);
drop policy if exists gp_vehicle_brands_admin_manage on public.gp_vehicle_brands;
create policy gp_vehicle_brands_admin_manage on public.gp_vehicle_brands
for all to authenticated using (public.gp_is_admin()) with check (public.gp_is_admin());

drop policy if exists gp_firm_brands_public_read on public.gp_firm_brands;
create policy gp_firm_brands_public_read on public.gp_firm_brands
for select to anon, authenticated using (public.gp_firm_publicly_visible(firm_id));
drop policy if exists gp_firm_brands_admin_manage on public.gp_firm_brands;
create policy gp_firm_brands_admin_manage on public.gp_firm_brands
for all to authenticated using (public.gp_is_admin()) with check (public.gp_is_admin());

drop policy if exists gp_firm_images_public_read on public.gp_firm_images;
create policy gp_firm_images_public_read on public.gp_firm_images
for select to anon, authenticated using (public.gp_firm_publicly_visible(firm_id));
drop policy if exists gp_firm_images_admin_manage on public.gp_firm_images;
create policy gp_firm_images_admin_manage on public.gp_firm_images
for all to authenticated using (public.gp_is_admin()) with check (public.gp_is_admin());

insert into public.gp_vehicle_brands(id,name,logo_url,sort_order) values
('alfa-romeo','Alfa Romeo','https://brandlogos.net/wp-content/uploads/2025/02/alfa_romeo-logo_brandlogos.net_nxlfy.png',1),
('audi','Audi','https://commons.wikimedia.org/wiki/Special:FilePath/Audi%20logo.svg',2),
('bmw','BMW','https://commons.wikimedia.org/wiki/Special:FilePath/BMW%20logo.svg',3),
('byd','BYD','https://commons.wikimedia.org/wiki/Special:FilePath/BYD%20Auto%202022%20logo.svg',4),
('chery','Chery','https://commons.wikimedia.org/wiki/Special:FilePath/Chery%20logo.svg',5),
('chevrolet','Chevrolet','https://1000logos-net.translate.goog/wp-content/uploads/2019/12/Chevrolet-logo.png?_x_tr_sl=en&_x_tr_tl=tr&_x_tr_hl=tr&_x_tr_pto=tc',6),
('citroen','Citroën','https://commons.wikimedia.org/wiki/Special:FilePath/Citroen%202019logo.svg',7),
('cupra','Cupra','https://commons.wikimedia.org/wiki/Special:FilePath/Cupra.svg',8),
('dacia','Dacia','https://commons.wikimedia.org/wiki/Special:FilePath/Dacia-Logo-2021.svg',9),
('fiat','Fiat','https://logos-world.net/wp-content/uploads/2021/03/Fiat-Logo.png',10),
('ford','Ford','https://commons.wikimedia.org/wiki/Special:FilePath/Ford%20logo.svg',11),
('honda','Honda','https://commons.wikimedia.org/wiki/Special:FilePath/Honda%20Logo.svg',12),
('hyundai','Hyundai','https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai%20Motor%20Company%20logo.svg',13),
('jeep','Jeep','https://commons.wikimedia.org/wiki/Special:FilePath/Jeep%20wordmark.svg',14),
('kia','Kia','https://commons.wikimedia.org/wiki/Special:FilePath/KIA%20logo3.svg',15),
('land-rover','Land Rover','https://images.seeklogo.com/logo-png/20/1/land-rover-logo-png_seeklogo-201638.png',16),
('mazda','Mazda','https://commons.wikimedia.org/wiki/Special:FilePath/Mazda%20logo.svg',17),
('mercedes-benz','Mercedes-Benz','https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-Benz%20Logo%202010.svg',18),
('nissan','Nissan','https://commons.wikimedia.org/wiki/Special:FilePath/Nissan%20Motor%20Corporation%202020%20logo.svg',19),
('opel','Opel','https://commons.wikimedia.org/wiki/Special:FilePath/Opel%20Logo%202021.svg',20),
('peugeot','Peugeot','https://commons.wikimedia.org/wiki/Special:FilePath/Peugeot%20Logo.svg',21),
('renault','Renault','https://commons.wikimedia.org/wiki/Special:FilePath/Renault%202021.svg',22),
('seat','SEAT','https://commons.wikimedia.org/wiki/Special:FilePath/SEAT%20Logo%20from%202017.svg',23),
('skoda','Škoda','https://upload.wikimedia.org/wikipedia/commons/0/09/%C5%A0koda_nieuw.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=original',24),
('togg','Togg','https://commons.wikimedia.org/wiki/Special:FilePath/TOGG%20logo.svg',25),
('toyota','Toyota','https://commons.wikimedia.org/wiki/Special:FilePath/Toyota%20carlogo.svg',26),
('volkswagen','Volkswagen','https://commons.wikimedia.org/wiki/Special:FilePath/Volkswagen%20logo%202019.svg',27),
('volvo','Volvo','https://commons.wikimedia.org/wiki/Special:FilePath/Volvo%20Iron%20Mark%20-%20black.svg',28)
on conflict (id) do nothing;

insert into public.gp_firms
(id,name,slug,logo_url,short_description,description,phone,phone_secondary,whatsapp,whatsapp_secondary,website,address,city,district,hours,rating,sponsored,status,is_verified)
values
('oto-bahtiyar','Oto Bahtiyar','oto-bahtiyar',null,'Hyundai ve Kia yedek parça firması.','Oto Bahtiyar, Hyundai ve Kia markalarına yönelik yedek parça alanında faaliyet gösteren firmadır.','0546 939 45 65',null,null,null,'https://otobahtiyar.com','Ayyıldız Sanayi Sitesi, 1141. Sokak No:25/2, Ostim, Ankara','Ankara','Yenimahalle',null,null,true,'active',true),
('smg-otomotiv','SMG Otomotiv','smg-otomotiv','/images/firms/smg-otomotiv/indir.webp','Volkswagen, SEAT, Audi ve Škoda çıkma ve sıfır yedek parça.','SMG Otomotiv, Volkswagen, SEAT, Audi ve Škoda marka araçlar için çıkma ve sıfır yedek parça alanında faaliyet göstermektedir. Parça ararken aracınızın modelini, üretim yılını, motor kodunu ve mevcut parçanın referans numarasını paylaşarak uyumluluk teyidi alabilirsiniz. Stok, fiyat, ürün durumu, garanti ve teslimat bilgilerini doğrudan firmayla görüşebilirsiniz.','0530 832 68 28',null,'905308326828',null,null,'OSTİM OSB Mah. 1127/1. Sk. No: 18, 06374 Yenimahalle / Ankara, Türkiye','Ankara','Yenimahalle',null,null,true,'active',true),
('uzman-hyundai','Uzman Hyundai','uzman-hyundai','/images/firms/uzman-hyundai/uzman-hyundai.webp','Hyundai ve Kia çıkma yedek parça firması.','Uzman Hyundai, Ankara Ostim''de Hyundai ve Kia marka araçlara yönelik çıkma yedek parça, motor ve şanzıman alanlarında faaliyet gösterir. Parça ve uyumluluk bilgisi için firmayla telefon veya WhatsApp üzerinden doğrudan iletişime geçebilirsiniz.','0507 412 19 50',null,'905074121950',null,'https://uzmanhyundai.com/','Ostim OSB Mah. 1126. Cad. No: 7, Yenimahalle / Ankara','Ankara','Yenimahalle',null,null,false,'active',true),
('tugul-fiat','Tuğul Fiat','tugul-fiat','/images/firms/tugul-fiat/unnamed (1).webp','Fiat çıkma motor, şanzıman ve yedek parça.','Tuğul Fiat, Ankara Ostim''de Fiat marka araçlara yönelik çıkma motor, şanzıman ve yedek parça alanında faaliyet göstermektedir. Doblo, Egea, Fiorino, Linea, Punto ve diğer Fiat modelleri için parça, stok ve uyumluluk bilgisi almak üzere firmayla telefon veya WhatsApp üzerinden iletişime geçebilirsiniz. Türkiye geneline gönderim ve ürün garantisi koşullarını doğrudan firmadan teyit edebilirsiniz.','0536 656 23 63',null,'905366562363',null,'https://tugulfiat.com','Ayyıldız Sanayi Sitesi, 1126. Cadde No: 7, Ostim, Yenimahalle / Ankara','Ankara','Yenimahalle',null,null,false,'active',true),
('cihat-hyundai','Cihat Hyundai','cihat-hyundai','/images/firms/cihat-hyundai/galeri/IMG_6534.PNG','Hyundai ve Kia sıfır ve çıkma yedek parça, sandık motor ve revizyonlu motor.','Cihat Hyundai, Ankara OSTİM''de Hyundai ve Kia marka araçlara yönelik sıfır ve çıkma yedek parça, sıfır sandık motor ve revizyonlu motor seçenekleri sunar. Accent, Getz, i10, i20, i30, Elantra, Tucson ve diğer Hyundai modelleri ile Kia modelleri için parça ve motor tedariki sağlar. Anahtar teslim motor montajı ve Türkiye geneline kargo seçenekleri hakkında doğrudan firmayla iletişime geçebilirsiniz. Ürün uyumluluğunu kontrol etmek için aracın modelini, üretim yılını ve motor kodunu paylaşmanız önerilir.','0553 738 38 06','0534 844 18 61','905537383806','905348441861','https://cihathyundai.com.tr','OSTİM OSB Mah. Ayyıldız Sanayi Sitesi, 1126. Cad. No: 14, Yenimahalle / Ankara','Ankara','Yenimahalle','08:00–18:00',4.9,true,'active',true)
on conflict (id) do nothing;

insert into public.gp_firm_brands(firm_id,brand_id) values
('oto-bahtiyar','hyundai'),
('oto-bahtiyar','kia'),
('smg-otomotiv','volkswagen'),
('smg-otomotiv','seat'),
('smg-otomotiv','audi'),
('smg-otomotiv','skoda'),
('uzman-hyundai','hyundai'),
('uzman-hyundai','kia'),
('tugul-fiat','fiat'),
('cihat-hyundai','hyundai'),
('cihat-hyundai','kia')
on conflict do nothing;

insert into public.gp_firm_images(firm_id,image_url,sort_order) values
('smg-otomotiv','/images/firms/smg-otomotiv/WhatsApp Image 2026-11-13 at 15.04.57.jpeg',1),
('smg-otomotiv','/images/firms/smg-otomotiv/WhatsApp Image 2026-11-13 at 15.04.57 (1).jpeg',2),
('smg-otomotiv','/images/firms/smg-otomotiv/WhatsApp Image 2026-11-13 at 20.07.49.jpeg',3),
('smg-otomotiv','/images/firms/smg-otomotiv/WhatsApp Image 2026-11-13 at 20.07.50.jpeg',4),
('smg-otomotiv','/images/firms/smg-otomotiv/WhatsApp Image 2026-11-13 at 20.07.50 (1).jpeg',5),
('uzman-hyundai','/images/firms/uzman-hyundai/uzman-hyundai.webp',1),
('uzman-hyundai','/images/firms/uzman-hyundai/uzman-hyundai-raf.webp',2),
('uzman-hyundai','/images/firms/uzman-hyundai/uzman-hyundai-raf2.webp',3),
('uzman-hyundai','/images/firms/uzman-hyundai/uzman-hyundai-raf3.webp',4),
('tugul-fiat','/images/firms/tugul-fiat/unnamed (1).webp',1),
('tugul-fiat','/images/firms/tugul-fiat/unnamed.webp',2),
('tugul-fiat','/images/firms/tugul-fiat/unnamed (2).webp',3),
('cihat-hyundai','/images/firms/cihat-hyundai/galeri/accent-admire-dizel-yarim-blok.JPEG',1),
('cihat-hyundai','/images/firms/cihat-hyundai/galeri/accent-blue-cikma-parca.JPEG',2),
('cihat-hyundai','/images/firms/cihat-hyundai/galeri/accent-yumurta-kasa-cikma-kaput.JPEG',3),
('cihat-hyundai','/images/firms/cihat-hyundai/galeri/hyundai-accent-admire-cikma-yedek-parca-cihat-hyundai-yedek-parca-hyundai-accent-admire-parca-admire-cikma-parca.jpeg',4),
('cihat-hyundai','/images/firms/cihat-hyundai/galeri/hyundai-accent-admire-yesil-cikma-yedek-yedek-parca-kaporta-bagaj-kapagi-komple-arka-camurluklar.jpeg',5),
('cihat-hyundai','/images/firms/cihat-hyundai/galeri/hyundai-accent-milenyum-bagaj-kapagi-hatasiz-cihat-hyundai-yedek-parca.jpeg',6),
('cihat-hyundai','/images/firms/cihat-hyundai/galeri/hyundai-getz-sag-arka-camurluk-mavi.jpeg',7)
on conflict (firm_id,image_url) do nothing;

commit;

-- Imported: 28 vehicle makes, 5 firm profiles,
-- 11 firm-brand links and 19 existing firm photo references.
-- Photos remain at their current website paths for now; moving binaries to object storage is a separate task.
