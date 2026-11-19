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

function slugify(value: string) {
  return value.toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i").replaceAll("ğ", "g").replaceAll("ü", "u")
    .replaceAll("ş", "s").replaceAll("ö", "o").replaceAll("ç", "c")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "E-posta doğrulamasından sonra giriş yapmalısınız." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Sunucu ayarları tamamlanmamış." }, 500);

    const auth = createClient(url, anon, { global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(authorization.slice(7));
    const user = authData.user;
    if (authError || !user?.email || !user.email_confirmed_at) {
      return json({ error: "Firma kaydı için doğrulanmış e-posta gereklidir." }, 403);
    }

    const body = await req.json();
    const required = ["name", "contactName", "phone", "whatsapp", "taxOrIdentityNumber",
      "province", "district", "address"];
    for (const field of required) {
      if (typeof body[field] !== "string" || !body[field].trim()) {
        return json({ error: "Zorunlu firma bilgileri eksik." }, 400);
      }
    }

    const name = body.name.trim();
    const contactName = body.contactName.trim();
    const phone = body.phone.trim();
    const whatsapp = body.whatsapp.trim();
    const taxNo = body.taxOrIdentityNumber.replace(/\s+/g, "");
    const province = body.province.trim();
    const district = body.district.trim();
    const address = body.address.trim();
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (name.length < 2 || name.length > 160 || contactName.length > 120 ||
        phone.length > 30 || whatsapp.length > 30 || province.length > 80 ||
        district.length > 80 || address.length > 500 || description.length > 3000 ||
        !/^\d{10,11}$/.test(taxNo)) {
      return json({ error: "Firma bilgilerini kontrol edin. Vergi/T.C. kimlik numarası 10 veya 11 rakam olmalıdır." }, 400);
    }

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existing, error: existingError } = await admin.from("firms")
      .select("id,slug").eq("owner_user_id", user.id).maybeSingle();
    if (existingError) {
      console.error("complete-firm-registration firms lookup failed", {
        code: existingError.code,
        message: existingError.message,
        details: existingError.details,
        hint: existingError.hint,
      });
      return json({ error: "Firma kaydı kontrol edilemedi.", diagnosticId: "FIRM_LOOKUP_FAILED" }, 500);
    }
    if (existing) return json({ success: true, firmId: existing.id, slug: existing.slug, alreadyRegistered: true });

    const base = slugify(name) || "firma";
    let created: { id: string; slug: string } | null = null;
    for (let attempt = 0; attempt < 4 && !created; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 6)}`;
      const { data, error } = await admin.from("firms").insert({
        owner_user_id: user.id, name, slug, contact_name: contactName,
        phone, whatsapp, email: user.email, tax_or_identity_number: taxNo,
        province, district, address, description: description || null,
        email_verified_at: user.email_confirmed_at, status: "active",
      }).select("id,slug").single();
      if (!error && data) created = data;
      else if (error?.code !== "23505") return json({ error: "Firma kaydı oluşturulamadı. Bilgileri kontrol edip tekrar deneyin." }, 400);
    }
    if (!created) return json({ error: "Firma bağlantı adresi oluşturulamadı. Tekrar deneyin." }, 409);

    return json({ success: true, firmId: created.id, slug: created.slug,
      message: "Firma kaydınız oluşturuldu. İlan yayınlamak için üyelik paketi seçip EFT bildirimi gönderin." }, 201);
  } catch {
    return json({ error: "Firma kaydı tamamlanamadı. Lütfen tekrar deneyin." }, 500);
  }
});
