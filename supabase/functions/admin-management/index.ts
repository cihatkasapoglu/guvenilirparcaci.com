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
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Yönetici girişi gereklidir." }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Sunucu ayarları tamamlanmamış." }, 500);

    const session = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await session.auth.getUser(authorization.slice(7));
    const user = authData.user;
    if (authError || !user?.email_confirmed_at) return json({ error: "Doğrulanmış yönetici hesabıyla giriş yapın." }, 403);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: adminRow, error: adminError } = await admin.from("admin_users")
      .select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError || !adminRow) return json({ error: "Bu hesap yönetici olarak yetkilendirilmemiş." }, 403);

    const body = await req.json();
    const action = body.action;
    const page = Math.max(1, Math.min(10000, Number(body.page) || 1));
    const pageSize = Math.max(1, Math.min(50, Number(body.pageSize) || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (action === "dashboard") {
      const [firms, listings, pendingPayments, complaints, memberships] = await Promise.all([
        admin.from("firms").select("id", { count: "exact", head: true }),
        admin.from("listings").select("id", { count: "exact", head: true }),
        admin.from("payment_notifications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        admin.from("complaints").select("id", { count: "exact", head: true }).in("status", ["new", "reviewing"]),
        admin.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active").gt("ends_at", new Date().toISOString()),
      ]);
      return json({ success: true, stats: {
        firms: firms.count ?? 0, listings: listings.count ?? 0,
        pendingPayments: pendingPayments.count ?? 0, openComplaints: complaints.count ?? 0,
        activeMemberships: memberships.count ?? 0,
      }});
    }

    if (action === "list") {
      const kind = body.kind;
      let query: any;
      if (kind === "firms") query = admin.from("firms").select("id,name,slug,email,phone,province,district,status,created_at", { count: "exact" }).order("created_at", { ascending: false });
      else if (kind === "payments") query = admin.from("payment_notifications").select("id,firm_id,package_id,membership_id,sender_name,amount_try,status,submitted_at,admin_note,firms(name),packages(name,listing_quota,price_try)", { count: "exact" }).order("submitted_at", { ascending: false });
      else if (kind === "complaints") query = admin.from("complaints").select("id,listing_id,email,reason,explanation,status,admin_note,created_at", { count: "exact" }).order("created_at", { ascending: false });
      else if (kind === "listings") query = admin.from("listings").select("id,firm_id,title,slug,status,province,district,price_try,price_type,created_at,expires_at,firms(name)", { count: "exact" }).order("created_at", { ascending: false });
      else if (kind === "packages") query = admin.from("packages").select("id,name,listing_quota,price_try,duration_days,is_active", { count: "exact" }).order("listing_quota");
      else if (kind === "featured") query = admin.from("featured_listings").select("id,listing_id,price_try,duration_days,starts_at,ends_at,payment_status,status,created_at,listings(title)", { count: "exact" }).order("created_at", { ascending: false });
      else return json({ error: "Liste türü geçersiz." }, 400);

      const { data, error, count } = await query.range(from, to);
      if (error) return json({ error: "Yönetim listesi alınamadı." }, 500);
      return json({ success: true, kind, data, total: count ?? 0, page, pageSize });
    }

    if (action === "approve_payment" || action === "reject_payment") {
      if (typeof body.notificationId !== "string") return json({ error: "Ödeme bildirimi numarası gereklidir." }, 400);
      const rpc = action === "approve_payment" ? "approve_payment_notification" : "reject_payment_notification";
      const args = action === "approve_payment"
        ? { p_notification_id: body.notificationId, p_admin_note: body.adminNote ?? null }
        : { p_notification_id: body.notificationId, p_admin_note: body.adminNote ?? "" };
      const { data, error } = await session.rpc(rpc, args);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, result: data });
    }

    if (action === "update_firm_status") {
      if (typeof body.firmId !== "string" || !["active", "suspended"].includes(body.status)) return json({ error: "Firma veya durum bilgisi geçersiz." }, 400);
      const { data: firm, error } = await admin.from("firms").update({ status: body.status })
        .eq("id", body.firmId).select("id,name,status").single();
      if (error) return json({ error: "Firma durumu değiştirilemedi." }, 400);
      await admin.from("admin_logs").insert({ admin_user_id: user.id, action: "firm_status_updated", target_type: "firm", target_id: firm.id, details: { status: body.status } });
      return json({ success: true, firm });
    }

    if (action === "update_package") {
      const id = Number(body.packageId), quota = Number(body.listingQuota), price = Number(body.priceTry), days = Number(body.durationDays);
      if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(quota) || quota < 1 ||
          !Number.isFinite(price) || price < 0 || price > 10000000 ||
          !Number.isSafeInteger(days) || days < 1 || days > 365) return json({ error: "Paket bilgileri geçersiz." }, 400);
      const { data: pkg, error } = await admin.from("packages")
        .update({ listing_quota: quota, price_try: price, duration_days: days, is_active: body.isActive !== false })
        .eq("id", id).select("*").single();
      if (error) return json({ error: "Paket güncellenemedi." }, 400);
      await admin.from("admin_logs").insert({ admin_user_id: user.id, action: "package_updated", target_type: "package", target_id: String(id), details: { listing_quota: quota, price_try: price, duration_days: days, is_active: body.isActive !== false } });
      return json({ success: true, package: pkg });
    }

    if (action === "moderate_complaint") {
      if (typeof body.complaintId !== "string" || !["new", "reviewing", "resolved", "dismissed"].includes(body.status)) return json({ error: "Şikâyet bilgileri geçersiz." }, 400);
      const { data: complaint, error } = await admin.from("complaints")
        .update({ status: body.status, admin_note: typeof body.adminNote === "string" ? body.adminNote.slice(0, 2000) : null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq("id", body.complaintId).select("id,status").single();
      if (error) return json({ error: "Şikâyet güncellenemedi." }, 400);
      await admin.from("admin_logs").insert({ admin_user_id: user.id, action: "complaint_moderated", target_type: "complaint", target_id: complaint.id, details: { status: complaint.status } });
      return json({ success: true, complaint });
    }

    if (action === "set_featured_settings") {
      const price = Number(body.priceTry), days = Number(body.durationDays);
      if (!Number.isFinite(price) || !Number.isInteger(days)) return json({ error: "Öne çıkarma ayarları geçersiz." }, 400);
      const { error } = await session.rpc("admin_update_featured_settings", { p_price_try: price, p_duration_days: days });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "approve_featured") {
      if (typeof body.featuredId !== "string") return json({ error: "Öne çıkarma kaydı gerekli." }, 400);
      const { data: row, error: readError } = await admin.from("featured_listings")
        .select("id,listing_id,duration_days,status,payment_status").eq("id", body.featuredId).single();
      if (readError || !row || row.status !== "pending" || row.payment_status !== "pending") return json({ error: "Onay bekleyen öne çıkarma kaydı bulunamadı." }, 404);
      const now = new Date();
      const ends = new Date(now.getTime() + row.duration_days * 86400000).toISOString();
      const { data: updated, error } = await admin.from("featured_listings")
        .update({ payment_status: "approved", status: "active", starts_at: now.toISOString(), ends_at: ends, approved_by: user.id })
        .eq("id", row.id).select("id,status,starts_at,ends_at").single();
      if (error) return json({ error: "Öne çıkarma etkinleştirilemedi." }, 400);
      await admin.from("admin_logs").insert({ admin_user_id: user.id, action: "featured_approved", target_type: "featured_listing", target_id: row.id, details: { listing_id: row.listing_id } });
      return json({ success: true, featured: updated });
    }

    if (action === "reject_featured") {
      if (typeof body.featuredId !== "string") return json({ error: "Öne çıkarma kaydı gerekli." }, 400);
      const { data, error } = await admin.from("featured_listings")
        .update({ payment_status: "rejected", status: "cancelled" })
        .eq("id", body.featuredId).eq("status", "pending")
        .select("id,status").single();
      if (error) return json({ error: "Öne çıkarma reddedilemedi." }, 400);
      await admin.from("admin_logs").insert({ admin_user_id: user.id, action: "featured_rejected", target_type: "featured_listing", target_id: data.id, details: {} });
      return json({ success: true, featured: data });
    }

    if (action === "admin_logs") {
      const { data, error, count } = await admin.from("admin_logs")
        .select("id,admin_user_id,action,target_type,target_id,details,created_at", { count: "exact" })
        .order("created_at", { ascending: false }).range(from, to);
      if (error) return json({ error: "İşlem kayıtları alınamadı." }, 500);
      return json({ success: true, data, total: count ?? 0, page, pageSize });
    }

    return json({ error: "Yönetim işlemi tanınmadı." }, 400);
  } catch {
    return json({ error: "Yönetim işlemi tamamlanamadı." }, 500);
  }
});
