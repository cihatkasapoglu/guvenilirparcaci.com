(function(){
  var el=document.querySelector("[data-daily-visits]");
  var cfg=window.GP_SUPABASE_CONFIG||{};
  if(!el)return;
  if(!cfg.url||!cfg.anonKey){
    el.textContent="Bugünkü ziyaret: bağlantı bekleniyor";
    return;
  }
  var base=String(cfg.url); while(base.endsWith("/")) base=base.slice(0,-1);
  fetch(base+"/rest/v1/rpc/increment_daily_visits",{
    method:"POST",
    headers:{
      "apikey":cfg.anonKey,
      "Authorization":"Bearer "+cfg.anonKey,
      "Content-Type":"application/json"
    },
    body:"{}",
    cache:"no-store"
  }).then(function(response){
    if(!response.ok)throw new Error("Sayaç isteği başarısız");
    return response.json();
  }).then(function(total){
    var value=Number(total);
    if(!Number.isFinite(value))throw new Error("Geçersiz sayaç yanıtı");
    el.textContent="Bugünkü ziyaret: "+new Intl.NumberFormat("tr-TR").format(value);
  }).catch(function(){
    el.textContent="Bugünkü ziyaret: yüklenemedi";
  });
})();