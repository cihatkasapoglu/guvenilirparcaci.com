(function(){
 const brands=window.GP_BRANDS||[], firms=window.GP_FIRMS||[];
 const params=new URLSearchParams(location.search);
 const routePath=decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g,""));
 const routeMatch=routePath.match(/^(.+)-yedek-parca$/);
 const slug=params.get("marka")||(routeMatch?routeMatch[1]:null), brand=brands.find(x=>x.id===slug);
 const brandIntros={
 "alfa-romeo":"Alfa Romeo araçlarda doğru yedek parçayı belirlemek için model, kasa nesli, üretim yılı ve motor kodunu birlikte kontrol edin. Firma profillerinden iletişim bilgilerine ulaşabilirsiniz.",
 "audi":"Audi yedek parça seçiminde model ve üretim yılı kadar motor kodu, şasi numarası ve parça referansı da önemlidir. İlgili firmaların profillerini inceleyerek doğrudan iletişim kurabilirsiniz.",
 "bmw":"BMW modellerinde kasa kodu, motor tipi ve üretim dönemi parça uyumluluğunu etkileyebilir. Yedek parça ararken parça numarasını ve araç bilgilerini karşılaştırın.",
 "byd":"BYD araçlar için yedek parça ararken model, üretim yılı ve araç donanımını dikkate alın. Elektronik ve yüksek voltaj sistemleriyle ilgili parçalarda uzman uyumluluk teyidi alın.",
 "chery":"Chery yedek parça seçiminde model yılı, motor seçeneği, kasa tipi ve parça kodunu kontrol edin. Firma profillerinden ilgili işletmelerin iletişim bilgilerine ulaşın.",
 "chevrolet":"Chevrolet araçlarda model ve kasa nesline göre parça farklılıkları olabilir. Doğru seçim için motor kodu, üretim tarihi ve eski parçanın numarasını paylaşın.",
 "citroen":"Citroën yedek parça ararken model, kasa, motor ve üretim dönemini birlikte değerlendirin. Özellikle elektronik parçalarda ürün koduyla uyumluluk teyidi alın.",
 "cupra":"CUPRA araçlarda motor ve donanım varyantları parça uyumluluğunu etkileyebilir. Parça aramasında şasi numarası ve üretici parça referansından yararlanın.",
 "dacia":"Dacia yedek parça seçiminde model yılı, motor tipi ve kasa bilgilerini netleştirin. Benzer model adlarına sahip farklı üretim dönemlerinde parça kodlarını karşılaştırın.",
 "fiat":"Fiat araçlarda doğru yedek parçayı bulmak için model, motor, üretim yılı ve parça kodunu kontrol edin. Firma profillerinden Fiat alanında faaliyet gösteren işletmelere ulaşabilirsiniz.",
 "ford":"Ford yedek parça ararken model ve motor seçeneğinin yanında üretim tarihi ile parça numarasını da doğrulayın. Elektronik bileşenlerde soket ve donanım uyumunu kontrol edin.",
 "honda":"Honda modellerinde kasa nesli, motor kodu ve üretim yılı yedek parça uyumluluğunda belirleyicidir. Satın almadan önce parça referansını araç bilgileriyle eşleştirin.",
 "hyundai":"Hyundai yedek parça ararken model yılı, kasa tipi, motor kodu ve parça numarasını birlikte değerlendirin. Accent, i10, i20, i30, Elantra ve Tucson gibi modellerde doğru uyumluluk kontrolü yapın.",
 "jeep":"Jeep yedek parça seçiminde model, kasa nesli, motor ve donanım bilgilerini netleştirin. Mekanik ve elektronik parçalarda üretici parça numarasıyla teyit alın.",
 "kia":"Kia modelleri için yedek parça seçerken model yılı, motor kodu, şasi numarası ve parça referansını kontrol edin. Rio, Ceed, Cerato ve Sportage gibi modellerde varyant farklarına dikkat edin.",
 "land-rover":"Land Rover araçlarda model, kasa ve motor varyantları parça uyumunu etkileyebilir. Özellikle elektronik ve aktarma organı parçalarında kod bazlı kontrol yapın.",
 "mazda":"Mazda yedek parça ararken model nesli, motor tipi, üretim yılı ve parça kodunu karşılaştırın. Eski parçanın etiketi ve fotoğrafı doğru eşleştirmeyi kolaylaştırır.",
 "mercedes-benz":"Mercedes-Benz araçlarda şasi serisi, motor kodu ve üretim tarihi parça seçiminde önemlidir. Donanım ve elektronik modül farklılıklarını parça numarasıyla doğrulayın.",
 "nissan":"Nissan yedek parça seçiminde model, kasa, motor ve üretim dönemi bilgilerini hazırlayın. Parça kodu ve bağlantı noktalarını karşılaştırarak uyumluluğu teyit edin.",
 "opel":"Opel araçlarda model yılı ve motor seçeneğine göre parça farklılıkları bulunabilir. Motor kodu, şasi numarası ve eski parçanın referansıyla doğru ürünü araştırın.",
 "peugeot":"Peugeot yedek parça ararken kasa nesli, motor kodu, üretim tarihi ve parça numarasını kontrol edin. Elektronik bileşenlerde donanım uyumluluğunu ayrıca teyit edin.",
 "renault":"Renault araçlarda motor, kasa ve üretim yılı farklılıkları doğru yedek parçayı belirlemede önemlidir. Şasi numarası ve parça koduyla uyumluluk kontrolü yapın.",
 "seat":"SEAT yedek parça seçiminde model nesli, motor kodu ve üretim dönemini dikkate alın. Benzer platformdaki araçlarda bile parça referansları farklı olabilir.",
 "skoda":"Škoda araçlarda model, motor kodu, kasa ve üretim tarihi parça uyumluluğunu belirler. Sipariş öncesinde eski parçanın numarasını ve araç şasi bilgisini karşılaştırın.",
 "togg":"Togg araçlarda yedek parça seçimi için model ve donanım bilgilerini esas alın. Elektronik ve yüksek voltaj bileşenlerinde yetkin uzmanlardan uyumluluk teyidi alın.",
 "toyota":"Toyota yedek parça seçiminde kasa nesli, motor, üretim tarihi ve parça kodunu birlikte kontrol edin. Hibrit sistem bileşenlerinde uzman katalog ve üretici bilgisiyle doğrulama yapın.",
 "volkswagen":"Volkswagen araçlarda motor kodu, şasi numarası ve parça numarası doğru yedek parçayı bulmanın temel bilgileridir. Golf, Polo, Passat ve Tiguan gibi modellerde üretim dönemi farklarına dikkat edin.",
 "volvo":"Volvo yedek parça ararken model nesli, motor tipi, üretim yılı ve parça referansını kontrol edin. Güvenlik ve elektronik sistem parçalarında doğru kod eşleşmesi önemlidir."
 };
 const root=document.getElementById("directoryRoot");
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const logo=(b)=>'<img src="'+esc(b.logo)+'" alt="'+esc(b.name)+'" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><span class="logo-fallback" style="display:none">'+esc(b.name.slice(0,2).toUpperCase())+'</span>';
 if(!root)return;
 function setMeta(name,content,property=false){let el=document.querySelector((property?'meta[property="':'meta[name="')+name+'"]');if(!el){el=document.createElement("meta");el.setAttribute(property?"property":"name",name);document.head.appendChild(el);}el.setAttribute("content",content);}
 function setCanonical(url){let el=document.querySelector('link[rel="canonical"]');if(!el){el=document.createElement("link");el.rel="canonical";document.head.appendChild(el);}el.href=url;}
 function setStructuredData(id,data){let el=document.getElementById(id);if(!el){el=document.createElement("script");el.type="application/ld+json";el.id=id;document.head.appendChild(el);}el.textContent=JSON.stringify(data);}
 if(!slug){
  document.title="Otomobil Markaları | GüvenilirParçacı";
  root.innerHTML='<div class="container page-intro"><div class="kicker">Marka rehberi</div><h1>Aracınızın markasını seçin</h1><p>Marka bazında güvenilir yedek parça firmalarını keşfedin.</p><div class="brand-grid">'+brands.map(b=>'<a class="brand-card" href="/'+encodeURIComponent(b.id)+'-yedek-parca">'+logo(b)+'<strong>'+esc(b.name)+'</strong><span class="card-arrow">›</span></a>').join("")+'</div></div>';
  const brandDescription="Otomobil markalarına göre yedek parça firmalarını keşfedin. Marka sayfalarında işletme profillerini, faaliyet alanlarını ve iletişim bilgilerini inceleyin.";
  setMeta("description",brandDescription);setMeta("og:title",document.title,true);setMeta("og:description",brandDescription,true);setMeta("og:url","https://guvenilirparcaci.com/markalar.html",true);setCanonical("https://guvenilirparcaci.com/markalar.html");
  setStructuredData("gp-directory-schema",{"@context":"https://schema.org","@type":"CollectionPage","name":"Otomobil Markaları | GüvenilirParçacı","description":brandDescription,"url":"https://guvenilirparcaci.com/markalar.html","inLanguage":"tr-TR","mainEntity":{"@type":"ItemList","itemListElement":brands.map((b,i)=>({"@type":"ListItem","position":i+1,"name":b.name,"url":"https://guvenilirparcaci.com/"+b.id+"-yedek-parca"}))}});
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
 function card(f,isSponsored){const score=weeklyScore(f),stars="★".repeat(Math.round(score))+"☆".repeat(5-Math.round(score));return '<a class="firm-card" href="/firma/'+encodeURIComponent(f.id)+'"><div class="firm-logo">'+(f.logo?'<img src="'+esc(f.logo)+'" alt="">':'<span>'+esc(f.name.slice(0,1))+'</span>')+'</div><div class="firm-info"><div class="firm-title">'+esc(f.name)+(isSponsored?'<span class="sponsor-tag">Sponsorlu</span>':'')+'</div><p>'+esc(f.shortDescription||"Yedek parça firması")+'</p><small>'+esc(f.address||"Adres bilgisi için firma profilini inceleyin")+'</small></div><div class="firm-rating"><span class="stars">'+stars+'</span><b>'+score.toFixed(1)+'</b></div><span class="card-arrow">›</span></a>';}

 root.innerHTML='<div class="container page-intro"><a class="back-link" href="markalar.html">← Tüm markalar</a><div class="brand-heading"><div class="brand-heading-logo">'+logo(brand)+'</div><div><div class="kicker">Marka firma rehberi</div><h1>'+esc(brand.name)+' yedek parça firmaları</h1><p>'+esc(brandIntros[brand.id]||("Bu sayfada "+brand.name+" yedek parça alanında faaliyet gösteren firmaların profillerini ve iletişim bilgilerini inceleyebilirsiniz."))+'</p></div></div><div class="firm-list">'+(sponsored.length?'<div class="list-label">Sponsorlu firmalar</div>'+sponsored.map(f=>card(f,true)).join(""):"")+(shuffled.length?'<div class="list-label">Firma rehberi</div>'+shuffled.map(f=>card(f,false)).join(""):"")+'</div>'+(!list.length?'<div class="empty-state"><strong>Bu marka için henüz firma kaydı bulunmuyor.</strong>Onaylanan firmalar eklendikçe burada listelenecektir.</div>':"")+'<p class="ranking-note">Sponsorlu yerleşimler ayrıca belirtilir. Yıldızlar haftalık platform sıralama göstergesidir; sıralama her pazartesi yenilenir.</p></div>';
 const pageDescription=brandIntros[brand.id]||("Türkiye genelinde "+brand.name+" yedek parça alanında faaliyet gösteren firmaların profillerini ve iletişim bilgilerini inceleyin.");
 setMeta("robots",list.length?"index,follow":"noindex,follow");
 setMeta("description",pageDescription);setMeta("og:title",document.title,true);setMeta("og:description",pageDescription,true);setMeta("og:url","https://guvenilirparcaci.com/"+brand.id+"-yedek-parca",true);setCanonical("https://guvenilirparcaci.com/"+brand.id+"-yedek-parca");
 const pageSchema={"@context":"https://schema.org","@type":"CollectionPage","name":brand.name+" Yedek Parça Firmaları | GüvenilirParçacı","description":pageDescription,"url":"https://guvenilirparcaci.com/"+brand.id+"-yedek-parca","inLanguage":"tr-TR","isPartOf":{"@type":"WebSite","name":"GüvenilirParçacı","url":"https://guvenilirparcaci.com/"}};
 if(list.length)pageSchema.mainEntity={"@type":"ItemList","itemListElement":list.map((f,i)=>({"@type":"ListItem","position":i+1,"name":f.name,"url":"https://guvenilirparcaci.com/firma/"+f.id}))};
 setStructuredData("gp-brand-schema",pageSchema);
})();
