import { createClient } from "npm:@supabase/supabase-js@2";

const origin = Deno.env.get("SITE_ORIGIN") ?? "https://guvenilirparcaci.com";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Giriş yapmanız gerekiyor." }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Sunucu ayarları tamamlanmamış." }, 500);

    const auth = createClient(url, anon, { global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(authorization.slice(7));
    const user = authData.user;
    if (authError || !user?.email_confirmed_at) {
      return json({ error: "Ödeme bildirimi için doğrulanmış e-posta gereklidir." }, 403);
    }

    const body = await req.json();
    const packageId = Number(body.packageId);
    const senderName = typeof body.senderName === "string" ? body.senderName.trim() : "";
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(packageId) || packageId <= 0 ||
        senderName.length < 2 || senderName.length > 120 ||
        !Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      return json({ error: "Paket, gönderen adı veya ödeme tutarı geçersiz." }, 400);
    }

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: firm, error: firmError } = await admin.from("firms")
      .select("id,status").eq("owner_user_id", user.id).maybeSingle();
    if (firmError || !firm || firm.status !== "active") return json({ error: "Aktif firma hesabı bulunamadı." }, 403);

    const { data, error } = await admin.rpc("submit_firm_payment_notice", {
      p_firm_id: firm.id,
      p_package_id: packageId,
      p_sender_name: senderName,
      p_amount_try: amount,
    });
    if (error) return json({ error: error.message || "Ödeme bildirimi kaydedilemedi." }, 400);
    return json({ success: true, ...data, message: "EFT bildiriminiz yönetici onayına gönderildi." }, 201);
  } catch {
    return json({ error: "Ödeme bildirimi tamamlanamadı. Lütfen tekrar deneyin." }, 500);
  }
});
