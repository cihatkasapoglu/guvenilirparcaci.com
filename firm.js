(function(){
 const root=document.getElementById("firmRoot");
 if(!root)return;
 const path=decodeURIComponent(location.pathname.replace(/\/+$/,""));
 const pathMatch=path.match(/^\/firma\/([^/]+)$/);
 const id=(pathMatch&&pathMatch[1])||new URLSearchParams(location.search).get("firma");
 const f=(window.GP_FIRMS||[]).find(x=>x.id===id&&x.approved);
 const e=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const setMeta=(name,content,property=false)=>{let el=document.querySelector((property?'meta[property="':'meta[name="')+name+'"]');if(!el){el=document.createElement("meta");el.setAttribute(property?"property":"name",name);document.head.appendChild(el);}el.setAttribute("content",content);};
 const setSchema=(data,id="gp-firm-schema")=>{let el=document.getElementById(id);if(!el){el=document.createElement("script");el.type="application/ld+json";el.id=id;document.head.appendChild(el);}el.textContent=JSON.stringify(data);};
 if(!f){
  setMeta("robots","noindex,follow");
  root.innerHTML='<a class="back-link" href="/markalar.html">← Marka rehberine dön</a><div class="empty-state"><strong>Firma profili bulunamadı.</strong>Bu firma henüz rehberde yayınlanmıyor.</div>';
  return;
 }
 const firmBrands=(f.brands||[]).map(id=>(window.GP_BRANDS||[]).find(b=>b.id===id)?.name||id);
 document.title=f.name+" | "+firmBrands.join(" ve ")+" Yedek Parça Firması | GüvenilirParçacı";
 const firmDescription=((f.description||f.shortDescription||"Otomotiv yedek parça alanında faaliyet gösteren firma.")+" Faaliyet gösterdiği markalar: "+firmBrands.join(", ")+". Firma iletişim ve işletme bilgileri.").slice(0,300);
 setMeta("description",firmDescription);setMeta("robots","index,follow");setMeta("og:type","profile",true);setMeta("og:title",document.title,true);setMeta("og:description",firmDescription,true);setMeta("og:url","https://guvenilirparcaci.com/firma/"+encodeURIComponent(f.id),true);
 const firmImage=f.logo||((f.photos||[])[0]||"");if(firmImage){const absoluteImage=new URL(firmImage,location.origin).href;setMeta("og:image",absoluteImage,true);setMeta("twitter:image",absoluteImage);}
 setMeta("twitter:card","summary");setMeta("twitter:title",document.title);setMeta("twitter:description",firmDescription);
 setSchema({"@context":"https://schema.org","@type":"Organization","name":f.name,"url":"https://guvenilirparcaci.com/firma/"+encodeURIComponent(f.id),"description":firmDescription,"telephone":f.phone||undefined,"email":f.email||undefined,"image":firmImage?new URL(firmImage,location.origin).href:undefined,"sameAs":f.website?[f.website]:undefined,"address":f.address?{"@type":"PostalAddress","streetAddress":f.address,"addressCountry":"TR"}:undefined,"knowsAbout":firmBrands});
 setSchema({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Ana Sayfa","item":"https://guvenilirparcaci.com/"},{"@type":"ListItem","position":2,"name":"Firma Profili","item":"https://guvenilirparcaci.com/markalar.html"},{"@type":"ListItem","position":3,"name":f.name,"item":"https://guvenilirparcaci.com/firma/"+encodeURIComponent(f.id)}]},"gp-firm-breadcrumb-schema");

 let canonical=document.querySelector('link[rel="canonical"]');
 if(!canonical){canonical=document.createElement("link");canonical.rel="canonical";document.head.appendChild(canonical);}
 canonical.href="https://guvenilirparcaci.com/firma/"+encodeURIComponent(f.id);
 root.innerHTML='<a class="back-link" href="/'+encodeURIComponent((f.brands||[])[0]||"")+'-yedek-parca">← Firma listesine dön</a><div class="brand-heading"><div class="brand-heading-logo">'+(f.logo?'<img src="'+e(f.logo)+'" alt="">':'<strong>'+e(f.name.slice(0,1))+'</strong>')+'</div><div><div class="kicker">Firma profili</div><h1>'+e(f.name)+'</h1><p>'+e(f.shortDescription||"Otomotiv yedek parça firması")+'</p></div></div><div class="profile-layout"><section class="profile-card"><h2>Firma hakkında</h2><p>'+e(f.description||"Firma hakkında detaylı bilgi henüz eklenmedi.")+'</p><div class="profile-meta"><div><b>Adres</b><span>'+e(f.address||"Bilgi eklenmedi")+'</span></div><div><b>Faaliyet gösterdiği markalar</b><span>'+e((f.brands||[]).map(id=>(window.GP_BRANDS||[]).find(b=>b.id===id)?.name||id).join(", ")||"Bilgi eklenmedi")+'</span></div><div><b>Çalışma saatleri</b><span>'+e(f.hours||"Bilgi eklenmedi")+'</span></div></div><div class="gallery">'+(f.photos||[]).map((p,i)=>'<button class="gallery-item" type="button" data-gallery-index="'+i+'" aria-label="Fotoğrafı büyüt"><img src="'+e(p)+'" alt="'+e(f.name)+' firma fotoğrafı" loading="lazy"></button>').join("")+'</div></section><aside class="contact-card"><h3>İletişim bilgileri</h3>'+(f.phone?'<a class="contact-link" href="tel:'+e(f.phone)+'">Telefon: '+e(f.phone)+'</a>':"")+(f.whatsapp?'<a class="contact-link" target="_blank" rel="noopener" href="https://wa.me/'+e(f.whatsapp.replace(/\D/g,""))+'?text='+encodeURIComponent("Merhaba, GüvenilirParçacı üzerinden "+f.name+" firmasına ulaşıyorum. Yedek parça ve firma bilgileriniz hakkında bilgi almak istiyorum.")+'">WhatsApp ile iletişim</a>':"")+(f.website?'<a class="contact-link" target="_blank" rel="noopener" href="'+e(f.website)+'">Web sitesi ↗</a>':"")+(f.email?'<a class="contact-link" href="mailto:'+e(f.email)+'">E-posta: '+e(f.email)+'</a>':"")+'</aside></div>';
 root.insertAdjacentHTML("beforeend",'<nav class="profile-brand-links" aria-label="Firmanın marka rehberleri"><strong>İlgili marka rehberleri</strong><div>'+(f.brands||[]).map(id=>{const b=(window.GP_BRANDS||[]).find(x=>x.id===id);return b?'<a href="/'+encodeURIComponent(b.id)+'-yedek-parca">'+e(b.name)+' yedek parça</a>':"";}).join("")+'</div></nav>');
 const galleryImages=Array.from(root.querySelectorAll(".gallery-item img"));
 if(galleryImages.length){
  const style=document.createElement("style");
  style.textContent='.gallery-item{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in;border-radius:10px;overflow:hidden}.gallery-item img{display:block;transition:transform .2s}.gallery-item:hover img{transform:scale(1.035)}.gp-lightbox{position:fixed;inset:0;z-index:9999;background:rgba(8,12,16,.92);display:none;align-items:center;justify-content:center;padding:24px}.gp-lightbox.open{display:flex}.gp-lightbox img{max-width:min(92vw,1200px);max-height:86vh;object-fit:contain;border-radius:8px}.gp-lightbox-close{position:absolute;top:18px;right:22px;width:44px;height:44px;border:0;border-radius:50%;background:#fff;color:#111;font-size:28px;cursor:pointer}.gp-lightbox-count{position:absolute;bottom:18px;left:0;right:0;text-align:center;color:#fff;font-size:13px}';
  document.head.appendChild(style);
  const lightbox=document.createElement("div");
  lightbox.className="gp-lightbox";
  lightbox.setAttribute("role","dialog");
  lightbox.setAttribute("aria-modal","true");
  lightbox.setAttribute("aria-label","Firma fotoğrafı");
  lightbox.innerHTML='<button class="gp-lightbox-close" type="button" aria-label="Kapat">×</button><img alt=""><div class="gp-lightbox-count"></div>';
  document.body.appendChild(lightbox);
  const large=lightbox.querySelector("img"),count=lightbox.querySelector(".gp-lightbox-count");
  let active=-1;
  const showPhoto=i=>{active=i;large.src=galleryImages[i].currentSrc||galleryImages[i].src;large.alt=galleryImages[i].alt;count.textContent=(i+1)+" / "+galleryImages.length;lightbox.classList.add("open");document.body.style.overflow="hidden";};
  const closePhoto=()=>{lightbox.classList.remove("open");document.body.style.overflow="";large.removeAttribute("src");};
  root.querySelectorAll(".gallery-item").forEach((btn,i)=>btn.addEventListener("click",()=>showPhoto(i)));
  lightbox.querySelector(".gp-lightbox-close").addEventListener("click",closePhoto);
  lightbox.addEventListener("click",ev=>{if(ev.target===lightbox)closePhoto();});
  document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&lightbox.classList.contains("open"))closePhoto();});
 }

})();