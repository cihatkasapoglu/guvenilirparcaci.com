import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";

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

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let s3: S3Client | null = null;
  let bucket = "";
  let objectKey = "";

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
    bucket = Deno.env.get("R2_BUCKET_NAME") ?? "";

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
    objectKey = typeof body.objectKey === "string" ? body.objectKey : "";
    if (!listingId || !objectKey || objectKey.length > 500) {
      return json({ error: "İlan veya dosya bilgisi geçersiz." }, 400);
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

    const expectedPrefix = `listings/${firm.id}/${listingId}/`;
    if (!objectKey.startsWith(expectedPrefix) || objectKey.includes("..")) {
      return json({ error: "Dosya anahtarı hesabınızla eşleşmiyor." }, 403);
    }

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id,firm_id")
      .eq("id", listingId)
      .eq("firm_id", firm.id)
      .maybeSingle();

    if (listingError || !listing) {
      return json({ error: "İlan bulunamadı." }, 404);
    }

    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    if (!head.ContentType || !allowedTypes.has(head.ContentType) ||
        !head.ContentLength || head.ContentLength < 1 ||
        head.ContentLength > 8 * 1024 * 1024 ||
        head.Metadata?.["firm-id"] !== firm.id ||
        head.Metadata?.["listing-id"] !== listingId) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      return json({ error: "Yüklenen fotoğraf doğrulamadan geçemedi." }, 400);
    }

    const { count, error: countError } = await admin
      .from("listing_images")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId);

    if (countError) return json({ error: "Fotoğraf sayısı kontrol edilemedi." }, 500);
    if ((count ?? 0) >= 5) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      return json({ error: "Bir ilana en fazla 5 fotoğraf eklenebilir." }, 409);
    }

    const displayOrder = (count ?? 0) + 1;
    const { data: image, error: insertError } = await admin
      .from("listing_images")
      .insert({
        listing_id: listingId,
        r2_object_key: objectKey,
        display_order: displayOrder,
        is_cover: displayOrder === 1,
      })
      .select("id,listing_id,display_order,is_cover")
      .single();

    if (insertError) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      return json({ error: "Fotoğraf kaydı oluşturulamadı. Lütfen tekrar deneyin." }, 409);
    }

    return json({ image });
  } catch (_error) {
    if (s3 && bucket && objectKey) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      } catch {
        // Cleanup is best-effort; a scheduled orphan-object cleanup will be added.
      }
    }
    return json({ error: "Fotoğraf doğrulanamadı veya kaydedilemedi." }, 500);
  }
});
