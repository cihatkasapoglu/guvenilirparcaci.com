(function(){
const cfg=window.GP_SUPABASE_CONFIG,sdk=window.supabase,root=document.getElementById("adminRoot");
if(!root)return;
if(!cfg||!sdk?.createClient){root.textContent="Supabase bağlantısı bulunamadı.";return;}
const db=sdk.createClient(cfg.url,cfg.anonKey);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function changeStatus(table,id,status,button){
  button.disabled=true;
  try{
    const refreshed=await db.auth.refreshSession();
    if(refreshed.error)throw refreshed.error;
    const session=refreshed.data.session;
    if(!session||session.user?.app_metadata?.role!=="admin"){
      throw new Error("Yönetici oturumu doğrulanamadı. Çıkış yapıp yeniden giriş yapın.");
    }
    const {data,error}=await db.from(table).update({status}).eq("id",id).select("id,status").maybeSingle();
    if(error)throw error;
    if(!data)throw new Error("Kayıt güncellenmedi. Yetki veya kayıt durumunu kontrol edin.");
    await load();
  }catch(error){
    button.disabled=false;
    const message=error?.message||String(error);
    alert("İşlem tamamlanamadı: "+message+"\n\nBağlantı hatası sürerse sayfayı yenileyip tekrar deneyin.");
  }
}
async function load(){
  try{
    const {data:{user},error:userError}=await db.auth.getUser();
    if(userError)throw userError;
    if(!user){location.href="/giris.html";return;}
    const {data:{session},error:sessionError}=await db.auth.getSession();
    if(sessionError)throw sessionError;
    if(session?.user?.app_metadata?.role!=="admin"){
      root.innerHTML='<div class="listing-empty">Bu alan yalnızca yönetici hesabına açıktır.</div>';
      return;
    }
    const [co,li]=await Promise.all([
      db.from("companies").select("id,name,phone,city,status,created_at").order("created_at",{ascending:false}).limit(100),
      db.from("listings").select("id,title,brand_id,model,city,status,created_at,companies(name)").order("created_at",{ascending:false}).limit(150)
    ]);
    if(co.error||li.error)throw co.error||li.error;
    root.innerHTML=
      '<section class="platform-panel-card"><h2>Firma başvuruları</h2><div class="panel-list">'+(co.data||[]).map(x=>
        '<div class="panel-list-item"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.city)+' · '+esc(x.phone)+'</small></div><div><span class="status-pill '+esc(x.status)+'">'+esc(x.status)+'</span>'+
        (x.status==="pending"?'<button class="platform-button" data-company="'+x.id+'" data-status="approved">Onayla</button>':
        x.status==="approved"?'<button class="platform-button secondary" data-company="'+x.id+'" data-status="suspended">Askıya al</button>':
        '<button class="platform-button" data-company="'+x.id+'" data-status="approved">Onayla</button>')+'</div></div>'
      ).join("")+'</div></section>'+
      '<section class="platform-panel-card"><h2>İlan yönetimi</h2><div class="panel-list">'+(li.data||[]).map(x=>
        '<div class="panel-list-item"><div><strong>'+esc(x.title)+'</strong><small>'+esc(x.companies?.name)+' · '+esc(x.model)+' · '+esc(x.city)+'</small></div><div><span class="status-pill '+esc(x.status)+'">'+esc(x.status)+'</span>'+
        (x.status==="pending"?'<button class="platform-button" data-listing="'+x.id+'" data-status="active">Yayınla</button><button class="platform-button secondary" data-listing="'+x.id+'" data-status="rejected">Reddet</button>':
        x.status==="active"?'<button class="platform-button secondary" data-listing="'+x.id+'" data-status="rejected">Yayından kaldır</button>':
        '<button class="platform-button" data-listing="'+x.id+'" data-status="active">Yayınla</button>')+'</div></div>'
      ).join("")+'</div></section>';
    root.querySelectorAll("[data-company]").forEach(button=>button.addEventListener("click",()=>changeStatus("companies",button.dataset.company,button.dataset.status,button)));
    root.querySelectorAll("[data-listing]").forEach(button=>button.addEventListener("click",()=>changeStatus("listings",button.dataset.listing,button.dataset.status,button)));
  }catch(error){
    root.innerHTML='<div class="listing-empty">Yönetim paneli yüklenemedi: '+esc(error?.message||error)+'</div>';
  }
}
load();
})();