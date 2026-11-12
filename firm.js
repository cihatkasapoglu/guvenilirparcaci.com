(function(){
 const root=document.getElementById("firmRoot");
 if(!root)return;
 const path=decodeURIComponent(location.pathname.replace(/\/+$/,""));
 const pathMatch=path.match(/^\/firma\/([^/]+)$/);
 const id=(pathMatch&&pathMatch[1])||new URLSearchParams(location.search).get("firma");
 const f=(window.GP_FIRMS||[]).find(x=>x.id===id&&x.approved);
 const e=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const setMeta=(name,content,property=false)=>{let el=document.querySelector((property?'meta[property="':'meta[name="')+name+'"]');if(!el){el=document.createElement("meta");el.setAttribute(property?"property":"name",name);document.head.appendChild(el);}el.setAttribute("content",content);};
 const setSchema=data=>{let el=document.getElementById("gp-firm-schema");if(!el){el=document.createElement("script");el.type="application/ld+json";el.id="gp-firm-schema";document.head.appendChild(el);}el.textContent=JSON.stringify(data);};
 if(!f){
  setMeta("robots","noindex,follow");
  root.innerHTML='<a class="back-link" href="/markalar.html">← Marka rehberine dön</a><div class="empty-state"><strong>Firma profili bulunamadı.</strong>Bu firma henüz rehberde yayınlanmıyor.</div>';
  return;
 }
 document.title=f.name+" | GüvenilirParçacı";
 const firmBrands=(f.brands||[]).map(id=>(window.GP_BRANDS||[]).find(b=>b.id===id)?.name||id);
 const firmDescription=(f.shortDescription||f.description||"Otomotiv yedek parça firması.")+" Firma profili, faaliyet gösterdiği markalar ve iletişim bilgileri.";
 setMeta("description",firmDescription);setMeta("robots","index,follow");setMeta("og:type","profile",true);setMeta("og:title",document.title,true);setMeta("og:description",firmDescription,true);setMeta("og:url","https://guvenilirparcaci.com/firma/"+encodeURIComponent(f.id),true);
 setSchema({"@context":"https://schema.org","@type":"Organization","name":f.name,"url":"https://guvenilirparcaci.com/firma/"+encodeURIComponent(f.id),"description":firmDescription,"telephone":f.phone||undefined,"address":f.address?{"@type":"PostalAddress","streetAddress":f.address,"addressCountry":"TR"}:undefined,"knowsAbout":firmBrands});

 let canonical=document.querySelector('link[rel="canonical"]');
 if(!canonical){canonical=document.createElement("link");canonical.rel="canonical";document.head.appendChild(canonical);}
 canonical.href="https://guvenilirparcaci.com/firma/"+encodeURIComponent(f.id);
 root.innerHTML='<a class="back-link" href="/'+encodeURIComponent((f.brands||[])[0]||"")+'-yedek-parca">← Firma listesine dön</a><div class="brand-heading"><div class="brand-heading-logo">'+(f.logo?'<img src="'+e(f.logo)+'" alt="">':'<strong>'+e(f.name.slice(0,1))+'</strong>')+'</div><div><div class="kicker">Firma profili</div><h1>'+e(f.name)+'</h1><p>'+e(f.shortDescription||"Otomotiv yedek parça firması")+'</p></div></div><div class="profile-layout"><section class="profile-card"><h2>Firma hakkında</h2><p>'+e(f.description||"Firma hakkında detaylı bilgi henüz eklenmedi.")+'</p><div class="profile-meta"><div><b>Adres</b><span>'+e(f.address||"Bilgi eklenmedi")+'</span></div><div><b>Faaliyet gösterdiği markalar</b><span>'+e((f.brands||[]).map(id=>(window.GP_BRANDS||[]).find(b=>b.id===id)?.name||id).join(", ")||"Bilgi eklenmedi")+'</span></div><div><b>Çalışma saatleri</b><span>'+e(f.hours||"Bilgi eklenmedi")+'</span></div></div><div class="gallery">'+(f.photos||[]).map(p=>'<img src="'+e(p)+'" alt="'+e(f.name)+' firma fotoğrafı" loading="lazy">').join("")+'</div></section><aside class="contact-card"><h3>İletişim bilgileri</h3>'+(f.phone?'<a class="contact-link" href="tel:'+e(f.phone)+'">Telefon: '+e(f.phone)+'</a>':"")+(f.whatsapp?'<a class="contact-link" target="_blank" rel="noopener" href="https://wa.me/'+e(f.whatsapp.replace(/\D/g,""))+'">WhatsApp ile iletişim</a>':"")+(f.website?'<a class="contact-link" target="_blank" rel="noopener" href="'+e(f.website)+'">Web sitesi ↗</a>':"")+(f.email?'<a class="contact-link" href="mailto:'+e(f.email)+'">E-posta: '+e(f.email)+'</a>':"")+'</aside></div>';
})();