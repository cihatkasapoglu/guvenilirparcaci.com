import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const origin = Deno.env.get("SITE_ORIGIN") ?? "https://guvenilirparcaci.com";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

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
    const contentType = body.contentType;
    const size = Number(body.size);
    if (!["logo", "cover"].includes(assetType) || !types[contentType] ||
        !Number.isInteger(size) || size < 1 || size > 5 * 1024 * 1024) {
      return json({ error: "Dosya türü veya boyutu uygun değil. JPG, PNG veya WebP; en fazla 5 MB." }, 400);
    }

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: firm, error: firmError } = await admin.from("firms")
      .select("id,status").eq("owner_user_id", data.user.id).maybeSingle();
    if (firmError || !firm || firm.status !== "active") return json({ error: "Aktif firma bulunamadı." }, 403);

    const objectKey = `firms/${firm.id}/${assetType}/${crypto.randomUUID()}.${types[contentType]}`;
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: access, secretAccessKey: secret },
    });
    const command = new PutObjectCommand({
      Bucket: bucket, Key: objectKey, ContentType: contentType,
      Metadata: { "firm-id": firm.id, "asset-type": assetType },
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    return json({
      uploadUrl, objectKey, expiresIn: 300,
      requiredHeaders: {
        "Content-Type": contentType,
        "x-amz-meta-firm-id": firm.id,
        "x-amz-meta-asset-type": assetType,
      },
    });
  } catch {
    return json({ error: "Yükleme bağlantısı oluşturulamadı." }, 500);
  }
});
