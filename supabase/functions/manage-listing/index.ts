import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";

const origin = Deno.env.get("SITE_ORIGIN") ?? "https://guvenilirparcaci.com";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

function makeSlug(title: string) {
  const normalized = title.toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i").replaceAll("ğ", "g").replaceAll("ü", "u")
    .replaceAll("ş", "s").replaceAll("ö", "o").replaceAll("ç", "c");
  const base = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110);
  return `${base || "yedek-parca"}-${crypto.randomUUID().slice(0, 8)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Giriş yapmanız gerekiyor." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Sunucu ayarları tamamlanmamış." }, 500);

    const auth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await auth.auth.getUser(authorization.slice(7));
    if (authError || !authData.user?.email_confirmed_at) {
      return json({ error: "Doğrulanmış e-posta ile giriş yapmanız gerekiyor." }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: firm, error: firmError } = await admin.from("firms")
      .select("id,status").eq("owner_user_id", authData.user.id).maybeSingle();
    if (firmError || !firm || firm.status !== "active") return json({ error: "Aktif firma hesabı bulunamadı." }, 403);

    const body = await req.json();
    const action = body.action;
    const listingId = typeof body.listingId === "string" ? body.listingId : null;
    if (!["create", "update", "publish", "withdraw", "delete"].includes(action)) {
      return json({ error: "İşlem türü geçersiz." }, 400);
    }
    if (["update", "publish", "withdraw", "delete"].includes(action) && !listingId) {
      return json({ error: "İlan numarası gereklidir." }, 400);
    }

    if (action === "create" || action === "update") {
      const p = body.listing;
      const compatibilities = body.compatibilities;
      if (!p || typeof p !== "object" || !Array.isArray(compatibilities)) {
        return json({ error: "İlan bilgileri veya araç uyumlulukları eksik." }, 400);
      }
      const title = typeof p.title === "string" ? p.title.trim() : "";
      const payload = {
        category_id: p.categoryId,
        subcategory_id: p.subcategoryId ?? null,
        part_type: p.partType,
        title,
        slug: action === "create" ? makeSlug(title) : (typeof p.slug === "string" ? p.slug : ""),
        description: p.description,
        fuel_type: p.fuelType ?? null,
        engine_code: p.engineCode ?? null,
        oem_number: p.oemNumber ?? null,
        price_type: p.priceType,
        price_try: p.priceType === "ask" ? null : p.price,
      };
      const cleanCompatibilities = compatibilities.map((item: Record<string, unknown>) => ({
        vehicle_model_id: item.vehicleModelId,
        year_from: item.yearFrom ?? null,
        year_to: item.yearTo ?? null,
      }));
      const { data: savedId, error: saveError } = await admin.rpc("save_firm_listing", {
        p_firm_id: firm.id,
        p_listing_id: action === "update" ? listingId : null,
        p_payload: payload,
        p_compatibilities: cleanCompatibilities,
      });
      if (saveError) return json({ error: saveError.message || "İlan kaydedilemedi." }, 400);
      const { data: savedListing, error: readError } = await admin.from("listings")
        .select("id,status,expires_at,slug").eq("id", savedId).eq("firm_id", firm.id).single();
      if (readError || !savedListing) return json({ error: "İlan kaydedildi ancak son durumu okunamadı." }, 500);
      return json({ success: true, listingId: savedId, status: savedListing.status,
        expiresAt: savedListing.expires_at, slug: savedListing.slug });
    }

    const { data: listing, error: listingError } = await admin.from("listings")
      .select("id,status").eq("id", listingId).eq("firm_id", firm.id).maybeSingle();
    if (listingError || !listing) return json({ error: "İlan bulunamadı veya size ait değil." }, 404);

    if (action === "publish") {
      const { data, error } = await admin.rpc("publish_firm_listing", {
        p_firm_id: firm.id, p_listing_id: listingId,
      });
      if (error) return json({ error: error.message || "İlan yayınlanamadı." }, 400);
      return json({ success: true, ...data });
    }

    if (action === "withdraw") {
      if (listing.status !== "published") return json({ error: "Yalnızca yayındaki ilan kaldırılabilir." }, 409);
      const { error } = await admin.from("listings")
        .update({ status: "withdrawn" }).eq("id", listingId).eq("firm_id", firm.id);
      if (error) return json({ error: "İlan yayından kaldırılamadı." }, 500);
      return json({ success: true, status: "withdrawn" });
    }

    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_NAME");
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      return json({ error: "R2 silme ayarları tamamlanmamış." }, 500);
    }
    const { data: images, error: imagesError } = await admin.from("listing_images")
      .select("r2_object_key").eq("listing_id", listingId);
    if (imagesError || !images) return json({ error: "İlan fotoğrafları alınamadı." }, 500);

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    for (const image of images) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: image.r2_object_key }));
    }
    const { error: deleteError } = await admin.from("listings")
      .delete().eq("id", listingId).eq("firm_id", firm.id);
    if (deleteError) return json({ error: "İlan veritabanından silinemedi." }, 500);
    return json({ success: true, deletedImages: images.length });
  } catch (_error) {
    return json({ error: "İlan işlemi tamamlanamadı. Lütfen tekrar deneyin." }, 500);
  }
});
