
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const sha = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    return json({ error: "Sunucu yapılandırması eksik." }, 500);
  }

  const db = createClient(url, key, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json();
    const action = body.action;
    const listingId = String(body.listing_id || "");

    if (!/^[0-9a-f-]{36}$/i.test(listingId)) {
      return json({ error: "Geçersiz ilan." }, 400);
    }

    const { data: isVisible, error: visibilityError } = await db.rpc(
      "is_listing_publicly_visible",
      { p_listing_id: listingId },
    );

    if (visibilityError) throw visibilityError;

    if (isVisible !== true) {
      return json({ error: "İlan yayında değil." }, 404);
    }

    if (action === "view") {
      const visitor = String(body.visitor_id || "");

      if (!/^[0-9a-f-]{36}$/i.test(visitor)) {
        return json({ error: "Ziyaretçi bilgisi geçersiz." }, 400);
      }

      // IP adresini al ve açık şekilde saklamadan hashle.
      const forwardedIp = req.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        .trim();

      const ip = req.headers.get("cf-connecting-ip") || forwardedIp;

      if (!ip) {
        return json({ error: "Ziyaretçi doğrulanamadı." }, 503);
      }

      const ipHash = await sha(ip + "|" + key);

      // IP başına dakikada en fazla 30 görüntülenme isteği.
      const { data: allowed, error: rateError } = await db.rpc(
        "consume_interaction_rate_limit",
        {
          p_ip_hash: ipHash,
          p_limit: 30,
        },
      );

      if (rateError) throw rateError;

      if (allowed !== true) {
        return json(
          {
            error:
              "Çok fazla görüntülenme isteği gönderdiniz. Lütfen bir dakika sonra tekrar deneyin.",
          },
          429,
        );
      }

      const fingerprint = await sha(
        visitor + "|" + (req.headers.get("user-agent") || "").slice(0, 180),
      );

      const { error } = await db.from("listing_views").upsert(
        {
          listing_id: listingId,
          viewer_fingerprint_hash: fingerprint,
          viewed_on: new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Istanbul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date()),
        },
        {
          onConflict: "listing_id,viewer_fingerprint_hash,viewed_on",
          ignoreDuplicates: true,
        },
      );

      if (error) throw error;

      const { count, error: ce } = await db
        .from("listing_views")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId);

      if (ce) throw ce;

      return json({ views: count || 0 });
    }

    if (action === "complaint") {
      if (String(body.website || "").trim()) {
        return json({ ok: true });
      }

      // Şikâyetler için görüntülenmelerden ayrı IP başına dakikada en fazla 3 istek.
      const forwardedIp = req.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        .trim();

      const ip = req.headers.get("cf-connecting-ip") || forwardedIp;

      if (!ip) {
        return json({ error: "Şikâyet isteği doğrulanamadı." }, 503);
      }

      // Ayrı anahtar alanı, görüntülenme sayacının şikâyet limitini etkilemesini önler.
      const complaintIpHash = await sha(ip + "|" + key + "|complaint");

      const { data: complaintAllowed, error: complaintRateError } = await db.rpc(
        "consume_interaction_rate_limit",
        {
          p_ip_hash: complaintIpHash,
          p_limit: 3,
        },
      );

      if (complaintRateError) throw complaintRateError;

      if (complaintAllowed !== true) {
        return json(
          { error: "Dakikalık şikâyet gönderme sınırına ulaştınız. Lütfen bir dakika sonra tekrar deneyin." },
          429,
        );
      }

      const email = String(body.email || "").trim().toLowerCase();
      const reason = String(body.reason || "").trim();
      const explanation = String(body.explanation || "").trim();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      ) {
        return json({ error: "Geçerli bir e-posta girin." }, 400);
      }

      const allowed = [
        "Yanlış veya yanıltıcı ilan",
        "Uygunsuz içerik",
        "Şüpheli veya sahte ürün",
        "İletişim bilgileri hatalı",
        "Diğer",
      ];

      if (
        !allowed.includes(reason) ||
        explanation.length < 10 ||
        explanation.length > 2000
      ) {
        return json({ error: "Şikâyet bilgilerini kontrol edin." }, 400);
      }

      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { count } = await db
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .eq("listing_id", listingId)
        .gte("created_at", since);

      if ((count || 0) >= 3) {
        return json(
          { error: "Bu ilan için saatlik şikâyet sınırına ulaştınız." },
          429,
        );
      }

      const { error } = await db.from("complaints").insert({
        listing_id: listingId,
        email,
        reason,
        explanation,
        status: "new",
      });

      if (error) throw error;

      return json({ ok: true });
    }

    return json({ error: "Bilinmeyen işlem." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "İşlem şu anda tamamlanamadı." }, 500);
  }
});
