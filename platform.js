(function(){
const cfg=window.GP_SUPABASE_CONFIG;
const client=window.supabase;
const brands=window.GP_BRANDS||[];
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=(v,c="TRY")=>v==null||v===""?"Fiyat sorunuz":new Intl.NumberFormat("tr-TR",{style:"currency",currency:c,maximumFractionDigits:0}).format(Number(v));
let db=null;
if(cfg&&client?.createClient)db=client.createClient(cfg.url,cfg.anonKey);
function message(el,text,type=""){if(el){el.className="platform-message "+type;el.textContent=text;}}
function brandOptions(selected=""){return brands.map(b=>'<option value="'+esc(b.id)+'" '+(b.id===selected?"selected":"")+'>'+esc(b.name)+'</option>').join("");}
function listingCard(item){const img=item.images?.[0]||"https://placehold.co/640x480/f2f4f5/66727d?text=Yedek+Parca";const b=brands.find(x=>x.id===item.brand_id);return '<a class="listing-card" href="/ilan.html?id='+encodeURIComponent(item.id)+'"><img src="'+esc(img)+'" alt="'+esc(item.title)+'" loading="lazy"><div class="listing-card-body"><h3>'+esc(item.title)+'</h3><div class="listing-meta"><span>'+esc(b?.name||item.brand_id)+'</span><span>·</span><span>'+esc(item.model||"Model belirtilmedi")+'</span><span>·</span><span>'+esc(item.city||"Türkiye")+'</span></div><div class="listing-price">'+money(item.price,item.currency)+'</div></div></a>';}
async function showListings(){
 const root=$("#listingResults");if(!root||!db)return;
 const params=new URLSearchParams(location.search),q=params.get("q")||"",brand=params.get("marka")||"",city=params.get("sehir")||"";
 let query=db.from("listings").select("id,title,brand_id,model,part_name,condition,price,currency,city,images,created_at").eq("status","active").order("created_at",{ascending:false}).limit(60);
 if(brand)query=query.eq("brand_id",brand);
 if(city)query=query.ilike("city","%"+city+"%");
 if(q)query=query.or("title.ilike.%"+q+"%,part_name.ilike.%"+q+"%,model.ilike.%"+q+"%,part_number.ilike.%"+q+"%");
 const {data,error}=await query;
 if(error){root.innerHTML='<div class="listing-empty">İlanlar şu anda yüklenemedi. Veritabanı kurulumu tamamlandığında burada yayınlanacak.</div>';return;}
 root.innerHTML=data?.length?'<div class="listing-grid">'+data.map(listingCard).join("")+'</div>':'<div class="listing-empty">Aramanıza uygun yayında ilan bulunamadı.</div>';
}
async function showListing(){
 const root=$("#listingDetail");if(!root||!db)return;
 const id=new URLSearchParams(location.search).get("id");if(!id){root.innerHTML='<div class="listing-empty">İlan bulunamadı.</div>';return;}
 const {data,error}=await db.from("listings").select("*,companies(name,phone,whatsapp,city,status)").eq("id",id).maybeSingle();
 if(error||!data){root.innerHTML='<div class="listing-empty">İlan bulunamadı veya yayından kaldırılmış.</div>';return;}
 const b=brands.find(x=>x.id===data.brand_id),img=data.images?.[0]||"https://placehold.co/900x675/f2f4f5/66727d?text=Yedek+Parca";
 const phone=(data.companies?.whatsapp||data.companies?.phone||"").replace(/\D/g,"");
 root.innerHTML='<div><img class="listing-detail-image" src="'+esc(img)+'" alt="'+esc(data.title)+'">'+(data.images||[]).slice(1).map(x=>'<img src="'+esc(x)+'" style="width:100px;height:80px;object-fit:cover;border-radius:8px;margin:8px 8px 0 0" alt="">').join("")+'</div><section><div class="listing-meta">'+esc(b?.name||data.brand_id)+' · '+esc(data.model)+' · '+esc(data.city)+'</div><h1>'+esc(data.title)+'</h1><div class="listing-price">'+money(data.price,data.currency)+'</div><p class="muted">'+esc(data.description)+'</p><div class="platform-panel-card"><h3>'+esc(data.companies?.name||"Satıcı")+'</h3><p class="muted">'+esc(data.companies?.city||data.city)+'</p>'+(phone?'<a class="platform-button" href="https://wa.me/90'+esc(phone.replace(/^90/,""))+'" target="_blank" rel="noopener">Satıcıya WhatsApp ile ulaş</a>':"")+'</div></section>';
}
async function authPage(){
 const form=$("#authForm");if(!form||!db)return;
 const msg=$("#authMessage");
 form.addEventListener("submit",async e=>{
 e.preventDefault();const fd=new FormData(form),mode=fd.get("mode"),email=String(fd.get("email")||""),password=String(fd.get("password")||"");
 const button=form.querySelector("button[type=submit]");button.disabled=true;
 let result;
 if(mode==="signup")result=await db.auth.signUp({email,password,options:{data:{company_name:fd.get("company_name"),phone:fd.get("phone"),city:fd.get("city")}}});
 else result=await db.auth.signInWithPassword({email,password});
 button.disabled=false;
 if(result.error){message(msg,result.error.message,"error");return;}
 message(msg,mode==="signup"?"Başvurunuz alındı. E-posta doğrulaması istenirse gelen kutunuzu kontrol edin. Firma hesabınız yönetici onayından sonra ilan yayınlayabilir.":"Giriş başarılı. Yönetim paneline yönlendiriliyorsunuz.","success");
 if(mode!=="signup")location.href="/panel.html";
 });
}
async function panelPage(){
 const root=$("#companyPanel");if(!root||!db)return;
 const msg=$("#panelMessage"),{data:{user}}=await db.auth.getUser();
 if(!user){location.href="/giris.html";return;}
 const {data:company,error}=await db.from("companies").select("*").eq("id",user.id).maybeSingle();
 if(error||!company){root.innerHTML='<div class="listing-empty">Firma profiliniz henüz oluşturulmadı. Çıkış yapıp yeniden giriş yapın veya destek alın.</div>';return;}
 root.innerHTML='<div class="platform-panel-card"><div class="panel-top"><div><h2>'+esc(company.name)+'</h2><p class="muted">Firma hesabı · '+(company.status==="approved"?"Onaylandı":company.status==="suspended"?"Askıya alındı":"Onay bekliyor")+'</p></div><button id="logoutButton" class="platform-button secondary">Çıkış yap</button></div><p class="muted">Firma bilgilerinizi tamamlayın. Onaylanan firmalar ilan yayınlayabilir.</p><form id="companyForm" class="platform-form"><div class="platform-form-grid"><div class="platform-field"><label>Firma adı</label><input name="name" required value="'+esc(company.name)+'"></div><div class="platform-field"><label>Telefon</label><input name="phone" value="'+esc(company.phone)+'"></div><div class="platform-field"><label>WhatsApp numarası</label><input name="whatsapp" value="'+esc(company.whatsapp)+'"></div><div class="platform-field"><label>Şehir</label><input name="city" value="'+esc(company.city)+'"></div><div class="platform-field full"><label>Adres</label><input name="address" value="'+esc(company.address)+'"></div><div class="platform-field full"><label>Firma açıklaması</label><textarea name="description">'+esc(company.description)+'</textarea></div></div><div class="platform-actions"><button class="platform-button">Firma bilgilerini kaydet</button></div></form></div><div class="platform-panel-card"><h2>Yeni yedek parça ilanı</h2><div id="panelMessage" class="platform-message"></div><form id="listingForm"><div class="platform-form-grid"><div class="platform-field full"><label>İlan başlığı</label><input name="title" required maxlength="120" placeholder="Örn. Hyundai Accent Era sağ far"></div><div class="platform-field"><label>Araç markası</label><select name="brand_id" required><option value="">Marka seçin</option>'+brandOptions()+'</select></div><div class="platform-field"><label>Model</label><input name="model" required placeholder="Örn. Accent Era"></div><div class="platform-field"><label>Parça adı</label><input name="part_name" placeholder="Örn. Sağ ön far"></div><div class="platform-field"><label>Parça numarası</label><input name="part_number"></div><div class="platform-field"><label>Ürün durumu</label><select name="condition"><option value="used">Çıkma</option><option value="new">Sıfır</option><option value="refurbished">Revizyonlu</option></select></div><div class="platform-field"><label>Fiyat (TL)</label><input name="price" type="number" min="0" step="1" placeholder="Fiyat belirtilmedi"></div><div class="platform-field"><label>Şehir</label><input name="city" value="'+esc(company.city)+'"></div><div class="platform-field full"><label>Açıklama</label><textarea name="description" placeholder="Ürün durumu, uyumluluk ve diğer bilgiler"></textarea></div><div class="platform-field full"><label>Fotoğraflar (en fazla 5 adet, JPG/PNG/WebP, her biri 5 MB)</label><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple></div></div><div class="platform-actions"><button class="platform-button" '+(company.status!=="approved"?"disabled":"")+'>'+ (company.status==="approved"?"İlanı gönder":"Firma onayı bekleniyor")+'</button></div></form></div><div class="platform-panel-card"><h2>İlanlarım</h2><div id="myListings" class="panel-list">Yükleniyor…</div></div>';
 $("#logoutButton").addEventListener("click",async()=>{await db.auth.signOut();location.href="/giris.html";});
 $("#companyForm").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const values=Object.fromEntries(f.entries());const {error}=await db.from("companies").update({...values,updated_at:new Date().toISOString()}).eq("id",user.id);message(msg,error?.message||"Firma bilgileriniz kaydedildi.",error?"error":"success");});
 const listingForm=$("#listingForm");
 listingForm.addEventListener("submit",async e=>{
 e.preventDefault();const f=new FormData(listingForm),button=listingForm.querySelector("button");button.disabled=true;
 try{
 const files=Array.from(listingForm.elements.images.files||[]);if(files.length>5)throw new Error("En fazla 5 fotoğraf yükleyebilirsiniz.");
 const urls=[];
 for(const file of files){if(file.size>5242880)throw new Error("Her fotoğraf en fazla 5 MB olabilir.");const ext=(file.name.split(".").pop()||"jpg").toLowerCase();const path=user.id+"/"+crypto.randomUUID()+"."+ext;const {error}=await db.storage.from("listing-images").upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;urls.push(db.storage.from("listing-images").getPublicUrl(path).data.publicUrl);}
 const payload={company_id:user.id,title:f.get("title"),brand_id:f.get("brand_id"),model:f.get("model"),part_name:f.get("part_name"),part_number:f.get("part_number"),condition:f.get("condition"),description:f.get("description"),price:f.get("price")?Number(f.get("price")):null,city:f.get("city"),images:urls,status:"pending"};
 const {error}=await db.from("listings").insert(payload);if(error)throw error;
 message(msg,"İlanınız alındı ve yönetici onayına gönderildi.","success");listingForm.reset();await loadMyListings(user.id);
 }catch(error){message(msg,error.message||"İlan kaydedilemedi.","error");}finally{button.disabled=false;}
 });
 await loadMyListings(user.id);
}
async function loadMyListings(uid){
 const root=$("#myListings");if(!root)return;const {data,error}=await db.from("listings").select("id,title,status,created_at").eq("company_id",uid).order("created_at",{ascending:false});
 if(error){root.textContent="İlanlar yüklenemedi: "+error.message;return;}
 root.innerHTML=data?.length?data.map(x=>'<div class="panel-list-item"><div><strong>'+esc(x.title)+'</strong><small>'+new Date(x.created_at).toLocaleDateString("tr-TR")+'</small></div><span class="status-pill '+esc(x.status)+'">'+({pending:"Onay bekliyor",active:"Yayında",rejected:"Reddedildi",sold:"Satıldı"}[x.status]||x.status)+'</span></div>').join(""):'<div class="muted">Henüz ilan eklemediniz.</div>';
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!db){document.querySelectorAll("[data-platform-error]").forEach(x=>message(x,"Supabase bağlantı ayarları bulunamadı.","error"));return;}
 showListings();showListing();authPage();panelPage();
});
})();