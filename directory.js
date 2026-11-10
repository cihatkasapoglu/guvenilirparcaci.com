(function(){
 const brands=window.GP_BRANDS||[], firms=window.GP_FIRMS||[];
 const params=new URLSearchParams(location.search), slug=params.get("marka"), brand=brands.find(x=>x.id===slug);
 const root=document.getElementById("directoryRoot");
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const logo=(b)=>'<img src="'+esc(b.logo)+'" alt="'+esc(b.name)+'" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><span class="logo-fallback" style="display:none">'+esc(b.name.slice(0,2).toUpperCase())+'</span>';
 if(!root)return;
 if(!slug){
  document.title="Otomobil Markaları | GüvenilirParçacı";
  root.innerHTML='<div class="container page-intro"><div class="kicker">Marka rehberi</div><h1>Aracınızın markasını seçin</h1><p>Marka bazında güvenilir yedek parça firmalarını keşfedin.</p><div class="brand-grid">'+brands.map(b=>'<a class="brand-card" href="marka.html?marka='+encodeURIComponent(b.id)+'">'+logo(b)+'<strong>'+esc(b.name)+'</strong><span class="card-arrow">›</span></a>').join("")+'</div></div>';
  return;
 }
 if(!brand){root.innerHTML='<div class="container page-intro"><h1>Marka bulunamadı</h1><a class="text-link" href="markalar.html">Tüm markalara dön</a></div>';return;}
 document.title=brand.name+" Yedek Parça Firmaları | GüvenilirParçacı";
 const list=firms.filter(f=>(f.brands||[]).includes(brand.id)&&f.approved);
 const sponsored=list.filter(f=>f.sponsored).slice(0,3), regular=list.filter(f=>!f.sponsored);
 // Haftalık sabit tohum: puanlar hafta boyunca sabit kalır, pazartesi yenilenir.
 const now=new Date(), monday=new Date(now);
 monday.setHours(0,0,0,0);
 monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
 const weekKey=monday.getFullYear()+"-"+String(monday.getMonth()+1).padStart(2,"0")+"-"+String(monday.getDate()).padStart(2,"0");
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
 function weeklyScore(f){return 3.5+(hash(f.id+"|"+weekKey)%16)/10;}
 const shuffled=regular.slice().sort((a,b)=>weeklyScore(b)-weeklyScore(a)||hash(a.id+"|order|"+weekKey)-hash(b.id+"|order|"+weekKey));
 function card(f,isSponsored){const score=weeklyScore(f),stars="★".repeat(Math.round(score))+"☆".repeat(5-Math.round(score));return '<a class="firm-card" href="firma.html?firma='+encodeURIComponent(f.id)+'"><div class="firm-logo">'+(f.logo?'<img src="'+esc(f.logo)+'" alt="">':'<span>'+esc(f.name.slice(0,1))+'</span>')+'</div><div class="firm-info"><div class="firm-title">'+esc(f.name)+(isSponsored?'<span class="sponsor-tag">Sponsorlu</span>':'')+'</div><p>'+esc(f.shortDescription||"Yedek parça firması")+'</p><small>'+esc(f.address||"Adres bilgisi için firma profilini inceleyin")+'</small></div><div class="firm-rating"><span class="stars">'+stars+'</span><b>'+score.toFixed(1)+'</b></div><span class="card-arrow">›</span></a>';}

 root.innerHTML='<div class="container page-intro"><a class="back-link" href="markalar.html">← Tüm markalar</a><div class="brand-heading"><div class="brand-heading-logo">'+logo(brand)+'</div><div><div class="kicker">Marka firma rehberi</div><h1>'+esc(brand.name)+' yedek parça firmaları</h1><p>Bu markada faaliyet gösteren, başvurusu onaylanmış firmalar.</p></div></div><div class="firm-list">'+(sponsored.length?'<div class="list-label">Sponsorlu firmalar</div>'+sponsored.map(f=>card(f,true)).join(""):"")+(shuffled.length?'<div class="list-label">Firma rehberi</div>'+shuffled.map(f=>card(f,false)).join(""):"")+'</div>'+(!list.length?'<div class="empty-state"><strong>Bu marka için henüz firma kaydı bulunmuyor.</strong>Onaylanan firmalar eklendikçe burada listelenecektir.</div>':"")+'<p class="ranking-note">Sponsorlu yerleşimler ayrıca belirtilir. Yıldızlar haftalık platform sıralama göstergesidir; sıralama her pazartesi yenilenir.</p></div>';
})();
