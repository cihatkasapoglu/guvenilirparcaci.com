-- Initial automotive spare-parts category tree.
-- Run after supabase/marketplace-foundation.sql.
-- Re-runnable by unique slug.

begin;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Motor ve Mekanik','motor-mekanik',10,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Komple Motor','motor-mekanik-01',10),
  ('Motor Bloğu','motor-mekanik-02',20),
  ('Silindir Kapağı','motor-mekanik-03',30),
  ('Piston ve Segman','motor-mekanik-04',40),
  ('Krank ve Eksantrik','motor-mekanik-05',50),
  ('Subap ve Supap Sistemi','motor-mekanik-06',60),
  ('Triger Seti ve Zinciri','motor-mekanik-07',70),
  ('Yağ Pompası ve Karter','motor-mekanik-08',80),
  ('Conta ve Keçe','motor-mekanik-09',90)
) as v(name,slug,sort_order)
where p.slug='motor-mekanik'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Şanzıman ve Debriyaj','sanziman-debriyaj',20,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Manuel Şanzıman','sanziman-debriyaj-01',10),
  ('Otomatik Şanzıman','sanziman-debriyaj-02',20),
  ('Şanzıman Parçaları','sanziman-debriyaj-03',30),
  ('Debriyaj Seti','sanziman-debriyaj-04',40),
  ('Volan ve Baskı Balata','sanziman-debriyaj-05',50),
  ('Aks ve Diferansiyel','sanziman-debriyaj-06',60)
) as v(name,slug,sort_order)
where p.slug='sanziman-debriyaj'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Kaporta ve Dış Aksam','kaporta-dis-aksam',30,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Kaput','kaporta-dis-aksam-01',10),
  ('Tampon','kaporta-dis-aksam-02',20),
  ('Çamurluk','kaporta-dis-aksam-03',30),
  ('Kapı','kaporta-dis-aksam-04',40),
  ('Bagaj Kapağı','kaporta-dis-aksam-05',50),
  ('Ayna','kaporta-dis-aksam-06',60),
  ('Far ve Stop','kaporta-dis-aksam-07',70),
  ('Cam ve Cam Mekanizması','kaporta-dis-aksam-08',80),
  ('Izgara ve Panjur','kaporta-dis-aksam-09',90)
) as v(name,slug,sort_order)
where p.slug='kaporta-dis-aksam'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Elektrik ve Elektronik','elektrik-elektronik',40,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Beyin ECU','elektrik-elektronik-01',10),
  ('Marş Dinamosu','elektrik-elektronik-02',20),
  ('Alternatör','elektrik-elektronik-03',30),
  ('Sensörler','elektrik-elektronik-04',40),
  ('Kablo Tesisatı','elektrik-elektronik-05',50),
  ('Sigorta Kutusu','elektrik-elektronik-06',60),
  ('Ekran ve Multimedya','elektrik-elektronik-07',70)
) as v(name,slug,sort_order)
where p.slug='elektrik-elektronik'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Yakıt ve Enjeksiyon','yakit-enjeksiyon',50,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Enjektör','yakit-enjeksiyon-01',10),
  ('Yakıt Pompası','yakit-enjeksiyon-02',20),
  ('Mazot Pompası','yakit-enjeksiyon-03',30),
  ('Benzin Pompası','yakit-enjeksiyon-04',40),
  ('Yakıt Deposu','yakit-enjeksiyon-05',50),
  ('Gaz Kelebeği','yakit-enjeksiyon-06',60)
) as v(name,slug,sort_order)
where p.slug='yakit-enjeksiyon'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Turbo ve Egzoz','turbo-egzoz',60,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Turbo','turbo-egzoz-01',10),
  ('Turbo Hortumu','turbo-egzoz-02',20),
  ('EGR Valfi','turbo-egzoz-03',30),
  ('DPF ve Partikül Filtresi','turbo-egzoz-04',40),
  ('Katalizör','turbo-egzoz-05',50),
  ('Egzoz Sistemi','turbo-egzoz-06',60)
) as v(name,slug,sort_order)
where p.slug='turbo-egzoz'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Soğutma ve Klima','sogutma-klima',70,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Radyatör','sogutma-klima-01',10),
  ('Fan ve Fan Motoru','sogutma-klima-02',20),
  ('Devirdaim Pompası','sogutma-klima-03',30),
  ('Termostat','sogutma-klima-04',40),
  ('Klima Kompresörü','sogutma-klima-05',50),
  ('Kalorifer Peteği','sogutma-klima-06',60),
  ('Klima Radyatörü','sogutma-klima-07',70)
) as v(name,slug,sort_order)
where p.slug='sogutma-klima'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Yürüyen Aksam ve Süspansiyon','yuruyen-aksam',80,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Amortisör','yuruyen-aksam-01',10),
  ('Helezon Yay','yuruyen-aksam-02',20),
  ('Salıncak','yuruyen-aksam-03',30),
  ('Rot ve Rot Başı','yuruyen-aksam-04',40),
  ('Porya ve Rulman','yuruyen-aksam-05',50),
  ('Direksiyon Kutusu','yuruyen-aksam-06',60),
  ('Viraj Demiri','yuruyen-aksam-07',70)
) as v(name,slug,sort_order)
where p.slug='yuruyen-aksam'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Fren Sistemi','fren-sistemi',90,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Fren Diski','fren-sistemi-01',10),
  ('Fren Balatası','fren-sistemi-02',20),
  ('Kaliper','fren-sistemi-03',30),
  ('ABS Beyni','fren-sistemi-04',40),
  ('Fren Merkezi','fren-sistemi-05',50),
  ('El Freni Sistemi','fren-sistemi-06',60)
) as v(name,slug,sort_order)
where p.slug='fren-sistemi'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('İç Aksam ve Aksesuar','ic-aksesuar',100,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Göğüs ve Torpido','ic-aksesuar-01',10),
  ('Koltuk','ic-aksesuar-02',20),
  ('Direksiyon Simidi','ic-aksesuar-03',30),
  ('Emniyet Kemeri','ic-aksesuar-04',40),
  ('İç Döşeme','ic-aksesuar-05',50),
  ('Vites Topuzu ve Körüğü','ic-aksesuar-06',60)
) as v(name,slug,sort_order)
where p.slug='ic-aksesuar'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Jant ve Lastik','jant-lastik',110,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Jant','jant-lastik-01',10),
  ('Lastik','jant-lastik-02',20),
  ('Bijon ve Aksesuar','jant-lastik-03',30)
) as v(name,slug,sort_order)
where p.slug='jant-lastik'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Aydınlatma','aydinlatma',120,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Ön Far','aydinlatma-01',10),
  ('Arka Stop','aydinlatma-02',20),
  ('Sis Farı','aydinlatma-03',30),
  ('Sinyal','aydinlatma-04',40),
  ('İç Aydınlatma','aydinlatma-05',50)
) as v(name,slug,sort_order)
where p.slug='aydinlatma'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Filtre ve Bakım Ürünleri','filtre-bakim',130,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Yağ Filtresi','filtre-bakim-01',10),
  ('Hava Filtresi','filtre-bakim-02',20),
  ('Polen Filtresi','filtre-bakim-03',30),
  ('Yakıt Filtresi','filtre-bakim-04',40),
  ('Bakım Seti','filtre-bakim-05',50)
) as v(name,slug,sort_order)
where p.slug='filtre-bakim'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Araç Ekipmanları','arac-ekipman',140,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Akü','arac-ekipman-01',10),
  ('Silecek','arac-ekipman-02',20),
  ('Kriko ve Bijon Anahtarı','arac-ekipman-03',30),
  ('Ayna ve Kamera Sistemleri','arac-ekipman-04',40)
) as v(name,slug,sort_order)
where p.slug='arac-ekipman'
on conflict (slug) do nothing;

insert into public.gp_categories(name,slug,sort_order,is_active)
values ('Diğer Yedek Parçalar','diger-parcalar',150,true)
on conflict (slug) do nothing;

insert into public.gp_categories(parent_id,name,slug,sort_order,is_active)
select p.id, v.name, v.slug, v.sort_order, true
from public.gp_categories p
cross join (values
  ('Diğer Motorlu Araç Parçaları','diger-parcalar-01',10),
  ('Ticari Araç Parçaları','diger-parcalar-02',20),
  ('Diğer','diger-parcalar-03',30)
) as v(name,slug,sort_order)
where p.slug='diger-parcalar'
on conflict (slug) do nothing;

commit;

-- Category tree prepared: 15 main categories and 89 subcategories.
