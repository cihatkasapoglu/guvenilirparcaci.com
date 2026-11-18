import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const sha=(v)=>createHash("sha256").update(v).digest("hex");
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return json({error:"Sunucu yapılandırması eksik."},500);
 const db=createClient(url,key,{auth:{persistSession:false}});
 try{
  const body=await req.json(),action=body.action,listingId=String(body.listing_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(listingId))return json({error:"Geçersiz ilan."},400);
  const {data:listing,error:le}=await db.from("listings").select("id,status,expires_at").eq("id",listingId).maybeSingle();
  if(le||!listing||listing.status!=="published"||!listing.expires_at||new Date(listing.expires_at)<=new Date())return json({error:"İlan yayında değil."},404);
  if(action==="view"){
   const visitor=String(body.visitor_id||"");
   if(!/^[0-9a-f-]{36}$/i.test(visitor))return json({error:"Ziyaretçi bilgisi geçersiz."},400);
   const fingerprint=sha(visitor+"|"+(req.headers.get("user-agent")||"").slice(0,180));
   const {error}=await db.from("listing_views").upsert({listing_id:listingId,viewer_fingerprint_hash:fingerprint,viewed_on:new Date(new Date().toLocaleString("en-US",{timeZone:"Europe/Istanbul"})).toISOString().slice(0,10)},{onConflict:"listing_id,viewer_fingerprint_hash,viewed_on",ignoreDuplicates:true});
   if(error)throw error;
   const {count,error:ce}=await db.from("listing_views").select("id",{count:"exact",head:true}).eq("listing_id",listingId);
   if(ce)throw ce;
   return json({views:count||0});
  }
  if(action==="complaint"){
   if(String(body.website||"").trim())return json({ok:true});
   const email=String(body.email||"").trim().toLowerCase(),reason=String(body.reason||"").trim(),explanation=String(body.explanation||"").trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json({error:"Geçerli bir e-posta girin."},400);
   const allowed=["Yanlış veya yanıltıcı ilan","Uygunsuz içerik","Şüpheli veya sahte ürün","İletişim bilgileri hatalı","Diğer"];
   if(!allowed.includes(reason)||explanation.length<10||explanation.length>2000)return json({error:"Şikâyet bilgilerini kontrol edin."},400);
   const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||"unknown";
   const limiter=sha(ip+"|"+email+"|"+listingId);
   const since=new Date(Date.now()-60*60*1000).toISOString();
   const {count}=await db.from("complaints").select("id",{count:"exact",head:true}).eq("email",email).eq("listing_id",listingId).gte("created_at",since);
   if((count||0)>=3)return json({error:"Bu ilan için saatlik şikâyet sınırına ulaştınız."},429);
   const {error}=await db.from("complaints").insert({listing_id:listingId,email,reason,explanation,status:"new"});
   if(error)throw error;
   return json({ok:true});
  }
  return json({error:"Bilinmeyen işlem."},400);
 }catch(e){console.error(e);return json({error:"İşlem şu anda tamamlanamadı."},500);}
});