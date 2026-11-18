import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";

const origin = Deno.env.get("SITE_ORIGIN") ?? "https://guvenilirparcaci.com";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Giriş yapmanız gerekiyor." }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const account = Deno.env.get("R2_ACCOUNT_ID");
    const access = Deno.env.get("R2_ACCESS_KEY_ID");
    const secret = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_NAME");
    if (!url || !anon || !service || !account || !access || !secret || !bucket) {
      return json({ error: "Sunucu ayarları tamamlanmamış." }, 500);
    }
    const auth = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.getUser(authorization.slice(7));
    if (error || !data.user?.email_confirmed_at) return json({ error: "E-posta doğrulaması gerekli." }, 403);

    const body = await req.json();
    const assetType = body.assetType;
    const objectKey = typeof body.objectKey === "string" ? body.objectKey : "";
    if (!["logo", "cover"].includes(assetType) || !objectKey || objectKey.length > 500) {
      return json({ error: "Dosya bilgisi geçersiz." }, 400);
    }
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: firm, error: firmError } = await admin.from("firms")
      .select("id,status,logo_object_key,cover_object_key")
      .eq("owner_user_id", data.user.id).maybeSingle();
    if (firmError || !firm || firm.status !== "active") return json({ error: "Aktif firma bulunamadı." }, 403);

    const prefix = `firms/${firm.id}/${assetType}/`;
    if (!objectKey.startsWith(prefix) || objectKey.includes("..")) return json({ error: "Dosya hesabınızla eşleşmiyor." }, 403);

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: access, secretAccessKey: secret },
    });
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    if (!head.ContentType || !allowed.has(head.ContentType) || !head.ContentLength ||
        head.ContentLength < 1 || head.ContentLength > 5 * 1024 * 1024 ||
        head.Metadata?.["firm-id"] !== firm.id || head.Metadata?.["asset-type"] !== assetType) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      return json({ error: "Dosya doğrulamadan geçemedi." }, 400);
    }

    const column = assetType === "logo" ? "logo_object_key" : "cover_object_key";
    const previousKey = assetType === "logo" ? firm.logo_object_key : firm.cover_object_key;
    const { error: updateError } = await admin.from("firms")
      .update({ [column]: objectKey }).eq("id", firm.id);
    if (updateError) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      return json({ error: "Firma görseli kaydedilemedi." }, 500);
    }
    if (previousKey && previousKey !== objectKey) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: previousKey }));
      } catch {
        // The old object can be removed by the scheduled orphan cleanup process.
      }
    }
    return json({ success: true, assetType, objectKey });
  } catch {
    return json({ error: "Firma görseli doğrulanamadı veya kaydedilemedi." }, 500);
  }
});
