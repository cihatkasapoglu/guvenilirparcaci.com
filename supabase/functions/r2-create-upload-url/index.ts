import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_ORIGIN") ?? "https://guvenilirparcaci.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

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
      return json({ error: "Sunucu yükleme ayarları tamamlanmamış." }, 500);
    }

    const token = authorization.slice("Bearer ".length);
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user || !authData.user.email_confirmed_at) {
      return json({ error: "Doğrulanmış e-posta ile giriş yapmanız gerekiyor." }, 403);
    }

    const body = await req.json();
    const listingId = typeof body.listingId === "string" ? body.listingId : "";
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = Number(body.size);

    if (!listingId || listingId.length > 80 || !fileName || fileName.length > 180) {
      return json({ error: "İlan veya dosya bilgisi geçersiz." }, 400);
    }
    const extension = allowedTypes.get(contentType);
    if (!extension) return json({ error: "Yalnızca JPG, PNG ve WebP yüklenebilir." }, 400);
    if (!Number.isFinite(size) || size < 1 || size > 8 * 1024 * 1024) {
      return json({ error: "Fotoğraf boyutu en fazla 8 MB olabilir." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: firm, error: firmError } = await admin
      .from("firms")
      .select("id,status")
      .eq("owner_user_id", authData.user.id)
      .maybeSingle();

    if (firmError || !firm || firm.status !== "active") {
      return json({ error: "Aktif firma hesabı bulunamadı." }, 403);
    }

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id,firm_id,status")
      .eq("id", listingId)
      .eq("firm_id", firm.id)
      .maybeSingle();

    if (listingError || !listing || !["draft", "published", "expired"].includes(listing.status)) {
      return json({ error: "İlan bulunamadı veya fotoğraf yükleme izniniz yok." }, 404);
    }

    const { count, error: countError } = await admin
      .from("listing_images")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId);

    if (countError) return json({ error: "Fotoğraf sayısı kontrol edilemedi." }, 500);
    if ((count ?? 0) >= 5) return json({ error: "Bir ilana en fazla 5 fotoğraf eklenebilir." }, 409);

    const objectKey = `listings/${firm.id}/${listingId}/${crypto.randomUUID()}.${extension}`;
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const s3 = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
      Metadata: {
        "firm-id": firm.id,
        "listing-id": listingId,
      },
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    return json({
      uploadUrl,
      objectKey,
      expiresIn: 300,
      requiredHeaders: {
        "Content-Type": contentType,
        "x-amz-meta-firm-id": firm.id,
        "x-amz-meta-listing-id": listingId,
      },
    });
  } catch (_error) {
    return json({ error: "Fotoğraf yükleme bağlantısı oluşturulamadı." }, 500);
  }
});
