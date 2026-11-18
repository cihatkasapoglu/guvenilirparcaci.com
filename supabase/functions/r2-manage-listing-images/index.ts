import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";

const allowedOrigin = Deno.env.get("SITE_ORIGIN") ?? "https://guvenilirparcaci.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Oturum açmanız gerekiyor." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_NAME");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !accountId ||
        !accessKeyId || !secretAccessKey || !bucket) {
      return json({ error: "Sunucu ayarları tamamlanmamış." }, 500);
    }

    const token = authorization.slice("Bearer ".length);
    const auth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    if (authError || !authData.user || !authData.user.email_confirmed_at) {
      return json({ error: "Doğrulanmış e-posta ile giriş yapmanız gerekiyor." }, 403);
    }

    const body = await req.json();
    const listingId = typeof body.listingId === "string" ? body.listingId : "";
    const action = body.action;
    if (!listingId || !["delete", "reorder", "set-cover"].includes(action)) {
      return json({ error: "İşlem bilgisi geçersiz." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: firm, error: firmError } = await admin
      .from("firms").select("id,status")
      .eq("owner_user_id", authData.user.id).maybeSingle();
    if (firmError || !firm || firm.status !== "active") {
      return json({ error: "Aktif firma hesabı bulunamadı." }, 403);
    }

    const { data: listing, error: listingError } = await admin
      .from("listings").select("id")
      .eq("id", listingId).eq("firm_id", firm.id).maybeSingle();
    if (listingError || !listing) return json({ error: "İlan bulunamadı." }, 404);

    const { data: images, error: imagesError } = await admin
      .from("listing_images")
      .select("id,r2_object_key,display_order,is_cover")
      .eq("listing_id", listingId)
      .order("display_order", { ascending: true });
    if (imagesError || !images) return json({ error: "Fotoğraflar alınamadı." }, 500);

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    if (action === "delete") {
      const imageId = typeof body.imageId === "string" ? body.imageId : "";
      const target = images.find((image) => image.id === imageId);
      if (!target) return json({ error: "Fotoğraf bulunamadı." }, 404);
      const remaining = images.filter((image) => image.id !== imageId);

      const { error: deleteRowError } = await admin
        .from("listing_images").delete().eq("id", imageId).eq("listing_id", listingId);
      if (deleteRowError) return json({ error: "Fotoğraf kaydı silinemedi." }, 500);

      // Database deletion is authoritative. If R2 deletion fails, a cleanup job can retry it.
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: target.r2_object_key }));
      } catch {
        return json({ warning: "Fotoğraf kaydı silindi; dosyanın fiziksel temizliği daha sonra tekrar denenecek." }, 202);
      }

      for (let i = 0; i < remaining.length; i++) {
        const { error } = await admin.from("listing_images")
          .update({ display_order: 10 + i, is_cover: false }).eq("id", remaining[i].id);
        if (error) return json({ error: "Fotoğraf sıralaması güncellenemedi." }, 500);
      }
      for (let i = 0; i < remaining.length; i++) {
        const { error } = await admin.from("listing_images")
          .update({ display_order: i + 1, is_cover: i === 0 }).eq("id", remaining[i].id);
        if (error) return json({ error: "Fotoğraf sıralaması güncellenemedi." }, 500);
      }
      return json({ success: true, images: remaining.length });
    }

    if (action === "set-cover") {
      const imageId = typeof body.imageId === "string" ? body.imageId : "";
      if (!images.some((image) => image.id === imageId)) {
        return json({ error: "Fotoğraf bulunamadı." }, 404);
      }
      const { error: clearError } = await admin.from("listing_images")
        .update({ is_cover: false }).eq("listing_id", listingId);
      if (clearError) return json({ error: "Kapak fotoğrafı değiştirilemedi." }, 500);
      const { error: setError } = await admin.from("listing_images")
        .update({ is_cover: true }).eq("id", imageId).eq("listing_id", listingId);
      if (setError) return json({ error: "Kapak fotoğrafı değiştirilemedi." }, 500);
      return json({ success: true, coverImageId: imageId });
    }

    const imageIds = body.imageIds;
    if (!Array.isArray(imageIds) || imageIds.length !== images.length ||
        imageIds.some((id: unknown) => typeof id !== "string") ||
        new Set(imageIds).size !== imageIds.length ||
        images.some((image) => !imageIds.includes(image.id))) {
      return json({ error: "Sıralama listesi ilandaki tüm fotoğrafları tam olarak içermeli." }, 400);
    }

    // Move rows to temporary unique positions first so swaps cannot violate the unique order index.
    for (let i = 0; i < imageIds.length; i++) {
      const { error } = await admin.from("listing_images")
        .update({ display_order: 10 + i, is_cover: false })
        .eq("id", imageIds[i]).eq("listing_id", listingId);
      if (error) return json({ error: "Fotoğraf sıralaması güncellenemedi." }, 500);
    }
    for (let i = 0; i < imageIds.length; i++) {
      const { error } = await admin.from("listing_images")
        .update({ display_order: i + 1, is_cover: i === 0 })
        .eq("id", imageIds[i]).eq("listing_id", listingId);
      if (error) return json({ error: "Fotoğraf sıralaması kaydedilemedi." }, 500);
    }
    return json({ success: true, images: imageIds.length });
  } catch (_error) {
    return json({ error: "Fotoğraf işlemi tamamlanamadı." }, 500);
  }
});
