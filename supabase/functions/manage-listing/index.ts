import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";

const origin = "*";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
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


const DRAFT_IMAGE_BUCKET = "site-images-drafts";

async function moveDraftImagesToPublic(admin: ReturnType<typeof createClient>, listingId: string) {
  const { data: images, error } = await admin.from("listing_images")
    .select("id,r2_object_key").eq("listing_id", listingId);
  if (error) throw new Error("Fotoğraf kayıtları okunamadı: " + error.message);
  for (const image of images || []) {
    const key = image.r2_object_key as string;
    if (!key.startsWith(`drafts/${listingId}/`)) continue;
    const publicKey = key.replace(/^drafts\//, "listings/");
    const { data: file, error: downloadError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).download(key);
    if (downloadError || !file) throw new Error("Taslak fotoğrafı okunamadı: " + key);
    const { error: uploadError } = await admin.storage.from("site-images").upload(publicKey, file, {
      contentType: file.type || "image/jpeg", upsert: true,
    });
    if (uploadError) throw new Error("Fotoğraf yayın alanına aktarılamadı: " + uploadError.message);
    const { error: updateError } = await admin.from("listing_images").update({ r2_object_key: publicKey })
      .eq("id", image.id).eq("listing_id", listingId);
    if (updateError) {
      await admin.storage.from("site-images").remove([publicKey]);
      throw new Error("Fotoğraf kaydı güncellenemedi: " + updateError.message);
    }
    const { error: removeError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).remove([key]);
    if (removeError) console.error("[manage-listing] private draft cleanup failed:", key, removeError);
  }
}

async function movePublicImagesToDraft(admin: ReturnType<typeof createClient>, listingId: string) {
  const { data: images, error } = await admin.from("listing_images")
    .select("id,r2_object_key").eq("listing_id", listingId);
  if (error) throw new Error("Fotoğraf kayıtları okunamadı: " + error.message);
  for (const image of images || []) {
    const key = image.r2_object_key as string;
    if (!key.startsWith(`listings/${listingId}/`)) continue;
    const draftKey = key.replace(/^listings\//, "drafts/");
    const { data: file, error: downloadError } = await admin.storage.from("site-images").download(key);
    if (downloadError || !file) throw new Error("Yayındaki fotoğraf özel alana alınamadı: " + key);
    const { error: uploadError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).upload(draftKey, file, {
      contentType: file.type || "image/jpeg", upsert: true,
    });
    if (uploadError) throw new Error("Fotoğraf özel alana kopyalanamadı: " + uploadError.message);
    const { error: updateError } = await admin.from("listing_images").update({ r2_object_key: draftKey })
      .eq("id", image.id).eq("listing_id", listingId);
    if (updateError) {
      await admin.storage.from(DRAFT_IMAGE_BUCKET).remove([draftKey]);
      throw new Error("Fotoğraf kaydı güncellenemedi: " + updateError.message);
    }
    const { error: removeError } = await admin.storage.from("site-images").remove([key]);
    if (removeError) console.error("[manage-listing] public image cleanup failed:", key, removeError);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const requestedHeaders = req.headers.get("Access-Control-Request-Headers");
    const preflightCors = {
      ...cors,
      "Access-Control-Allow-Headers": requestedHeaders || cors["Access-Control-Allow-Headers"],
    };
    return new Response("ok", { status: 200, headers: preflightCors });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const requestPayload = await req.json();
    const bodyToken = typeof requestPayload?._accessToken === "string" ? requestPayload._accessToken.trim() : "";
    const headerAuthorization = req.headers.get("Authorization")?.trim() || "";
    const authorization = bodyToken ? "Bearer " + bodyToken : headerAuthorization;
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

    const body = requestPayload;
    delete body._accessToken;
    const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
    const listingId = typeof body.listingId === "string" ? body.listingId.trim() : null;
    if (!["create", "update", "publish", "promote_images", "secure_existing_drafts", "withdraw", "delete", "delete_image", "reorder_images", "register_image"].includes(action)) {
      return json({ error: "İşlem türü geçersiz." }, 400);
    }
    if (["update", "publish", "promote_images", "withdraw", "delete", "delete_image", "reorder_images", "register_image"].includes(action) && !listingId) {
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

    if (action === "secure_existing_drafts") {
      const { data: rows, error: rowsError } = await admin.from("listings")
        .select("id,status,expires_at").eq("firm_id", firm.id);
      if (rowsError) return json({ error: "Mevcut ilanlar kontrol edilemedi." }, 500);
      const targets = (rows || []).filter((row: {id:string;status:string;expires_at:string|null}) =>
        row.status !== "published" || (row.expires_at && new Date(row.expires_at).getTime() <= Date.now())
      );
      let secured = 0;
      try {
        for (const row of targets) {
          await movePublicImagesToDraft(admin, row.id);
          secured++;
        }
      } catch (moveError) {
        const detail = moveError instanceof Error ? moveError.message : String(moveError);
        return json({ error: "Bazı eski taslak fotoğrafları özel alana taşınamadı.", secured, detail }, 500);
      }
      return json({ success: true, securedListings: secured });
    }

    const { data: listing, error: listingError } = await admin.from("listings")
      .select("id,status").eq("id", listingId).eq("firm_id", firm.id).maybeSingle();
    if (listingError || !listing) return json({ error: "İlan bulunamadı veya size ait değil." }, 404);

    if (action === "register_image") {
      const objectKey = typeof body.objectKey === "string" ? body.objectKey : "";
      const contentType = typeof body.contentType === "string" ? body.contentType : "";
      const size = Number(body.size);
      const safeObjectKey = objectKey.startsWith(`drafts/${listingId}/`) && !objectKey.includes("..");
      if (!safeObjectKey ||
          !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
          !Number.isFinite(size) || size < 1 || size > 8 * 1024 * 1024) {
        // The browser may already have uploaded this file. Remove it only when
        // the key is safely confined to this listing's own Storage folder.
        if (safeObjectKey) {
          const { error: cleanupError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).remove([objectKey]);
          if (cleanupError) console.error("[manage-listing] invalid image cleanup failed:", {
            listingId, objectKey, cleanupError,
          });
        }
        return json({ error: "Yüklenen fotoğraf bilgileri geçersiz." }, 400);
      }

      const { data: existingImages, error: countError } = await admin.from("listing_images")
        .select("id").eq("listing_id", listingId);
      if (countError) {
        const { error: cleanupError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).remove([objectKey]);
        console.error("[manage-listing] image count check failed:", {
          listingId, objectKey, countError, cleanupError,
        });
        return json({
          error: "Fotoğraf sayısı kontrol edilemedi.",
          cleanupError: cleanupError?.message ?? null,
          code: (countError as { code?: string }).code ?? null,
        }, 500);
      }

      const count = existingImages?.length ?? 0;
      if (count >= 5) {
        const { error: cleanupError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).remove([objectKey]);
        if (cleanupError) console.error("[manage-listing] max image limit cleanup failed:", {
          listingId, objectKey, cleanupError,
        });
        return json({
          error: "Bir ilana en fazla 5 fotoğraf eklenebilir.",
          cleanupError: cleanupError?.message ?? null,
        }, 409);
      }

      const displayOrder = count + 1;
      const { error: insertError } = await admin.from("listing_images").insert({
        listing_id: listingId, r2_object_key: objectKey,
        display_order: displayOrder, is_cover: displayOrder === 1,
      });
      if (insertError) {
        const { error: cleanupError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).remove([objectKey]);
        console.error("[manage-listing] image row insert failed:", {
          listingId, objectKey, insertError, cleanupError,
        });
        return json({
          error: "Fotoğraf kaydı oluşturulamadı.",
          cleanupError: cleanupError?.message ?? null,
        }, 409);
      }
      return json({ success: true, displayOrder });
    }

    if (action === "promote_images") {
      if (listing.status !== "published") return json({ error: "Yalnızca yayındaki ilanın fotoğrafları yayın alanına aktarılabilir." }, 409);
      try {
        await moveDraftImagesToPublic(admin, listingId);
        return json({ success: true });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return json({ error: "Fotoğraflar yayın alanına aktarılamadı.", detail }, 500);
      }
    }

    if (action === "publish") {
      const { data, error } = await admin.rpc("publish_firm_listing", {
        p_firm_id: firm.id, p_listing_id: listingId,
      });
      if (error) return json({ error: error.message || "İlan yayınlanamadı." }, 400);
      try {
        await moveDraftImagesToPublic(admin, listingId);
      } catch (moveError) {
        const detail = moveError instanceof Error ? moveError.message : String(moveError);
        await admin.from("listings").update({ status: "withdrawn" }).eq("id", listingId).eq("firm_id", firm.id);
        try { await movePublicImagesToDraft(admin, listingId); } catch (rollbackError) {
          console.error("[manage-listing] publish image rollback failed:", rollbackError);
        }
        return json({ error: "İlan yayınlanamadı; fotoğrafların güvenliği için ilan taslak dışı bırakıldı.", detail }, 500);
      }
      return json({ success: true, ...data });
    }

    if (action === "reorder_images") {
      const imageIds = body.imageIds;
      if (!Array.isArray(imageIds) || imageIds.length < 1 || imageIds.length > 5 ||
          imageIds.some((id: unknown) => typeof id !== "string")) {
        return json({ error: "Fotoğraf sıralaması geçersiz." }, 400);
      }
      const { error } = await admin.rpc("set_listing_image_order", {
        p_firm_id: firm.id, p_listing_id: listingId, p_image_ids: imageIds,
      });
      if (error) return json({ error: error.message || "Fotoğraf sıralaması kaydedilemedi." }, 400);
      return json({ success: true });
    }

    if (action === "delete_image") {
      const imageId = typeof body.imageId === "string" ? body.imageId : "";
      if (!imageId) return json({ error: "Fotoğraf kaydı belirtilmedi." }, 400);
      const { data: image, error: imageError } = await admin.from("listing_images")
        .select("id,r2_object_key").eq("id", imageId).eq("listing_id", listingId).maybeSingle();
      if (imageError || !image) return json({ error: "Fotoğraf bulunamadı." }, 404);
      if (listing.status === "published") {
        const { count, error: countError } = await admin.from("listing_images")
          .select("id", { count: "exact", head: true }).eq("listing_id", listingId);
        if (countError) return json({ error: "Fotoğraf sayısı kontrol edilemedi." }, 500);
        if ((count ?? 0) <= 1) {
          return json({ error: "Yayındaki ilanın en az bir fotoğrafı kalmalıdır. Önce yeni fotoğraf ekleyin." }, 409);
        }
      }
      if (image.r2_object_key.startsWith("listings/")) {
        const { error: storageError } = await admin.storage.from("site-images").remove([image.r2_object_key]);
        if (storageError) return json({ error: "Supabase fotoğrafı silinemedi." }, 500);
      } else if (image.r2_object_key.startsWith("drafts/")) {
        const { error: storageError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).remove([image.r2_object_key]);
        if (storageError) return json({ error: "Taslak fotoğrafı silinemedi." }, 500);
      } else {
        const accountId = Deno.env.get("R2_ACCOUNT_ID");
        const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
        const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
        const bucket = Deno.env.get("R2_BUCKET_NAME");
        if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
          return json({ error: "Eski R2 fotoğrafı için silme ayarları tamamlanmamış." }, 500);
        }
        const s3 = new S3Client({
          region: "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        });
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: image.r2_object_key }));
      }
      const { error: removeError } = await admin.from("listing_images")
        .delete().eq("id", imageId).eq("listing_id", listingId);
      if (removeError) return json({ error: "Fotoğraf kaydı silinemedi." }, 500);
      const { data: remaining, error: remainingError } = await admin.from("listing_images")
        .select("id").eq("listing_id", listingId).order("display_order");
      if (remainingError) return json({ error: "Kalan fotoğraflar sıralanamadı." }, 500);
      if (remaining?.length) {
        const { error: orderError } = await admin.rpc("set_listing_image_order", {
          p_firm_id: firm.id, p_listing_id: listingId, p_image_ids: remaining.map((x: {id:string}) => x.id),
        });
        if (orderError) return json({ error: "Fotoğraf silindi ancak sıralama güncellenemedi." }, 500);
      }
      return json({ success: true });
    }

    if (action === "withdraw") {
      if (listing.status !== "published") return json({ error: "Yalnızca yayındaki ilan kaldırılabilir." }, 409);
      const { error } = await admin.from("listings")
        .update({ status: "withdrawn" }).eq("id", listingId).eq("firm_id", firm.id);
      if (error) {
        console.error("[manage-listing] withdraw update failed:", {
          message: error.message, code: error.code, details: error.details, hint: error.hint,
        });
        return json({ error: "İlan yayından kaldırılamadı.", detail: error.message || null, code: error.code || null }, 500);
      }
      try {
        await movePublicImagesToDraft(admin, listingId);
      } catch (moveError) {
        const detail = moveError instanceof Error ? moveError.message : String(moveError);
        return json({ error: "İlan yayından kaldırıldı ancak bazı fotoğraflar özel alana taşınamadı.", detail }, 500);
      }
      return json({ success: true, status: "withdrawn" });
    }

    const { data: images, error: imagesError } = await admin.from("listing_images")
      .select("r2_object_key").eq("listing_id", listingId);
    if (imagesError || !images) return json({ error: "İlan fotoğrafları alınamadı." }, 500);
    const publicKeys = images.map((image: {r2_object_key:string}) => image.r2_object_key)
      .filter((key: string) => key.startsWith("listings/"));
    if (publicKeys.length) {
      const { error: storageError } = await admin.storage.from("site-images").remove(publicKeys);
      if (storageError) return json({ error: "Yayın fotoğrafları silinemedi." }, 500);
    }
    const draftKeys = images.map((image: {r2_object_key:string}) => image.r2_object_key)
      .filter((key: string) => key.startsWith("drafts/"));
    if (draftKeys.length) {
      const { error: storageError } = await admin.storage.from(DRAFT_IMAGE_BUCKET).remove(draftKeys);
      if (storageError) return json({ error: "Taslak fotoğrafları silinemedi." }, 500);
    }
    const legacyKeys = images.map((image: {r2_object_key:string}) => image.r2_object_key)
      .filter((key: string) => !key.startsWith("listings/") && !key.startsWith("drafts/"));
    if (legacyKeys.length) {
      const accountId = Deno.env.get("R2_ACCOUNT_ID");
      const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
      const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
      const bucket = Deno.env.get("R2_BUCKET_NAME");
      if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
        return json({ error: "Eski R2 fotoğrafları için silme ayarları tamamlanmamış." }, 500);
      }
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      for (const key of legacyKeys) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
    const { error: deleteError } = await admin.from("listings")
      .delete().eq("id", listingId).eq("firm_id", firm.id);
    if (deleteError) return json({ error: "İlan veritabanından silinemedi." }, 500);
    return json({ success: true, deletedImages: images.length });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[manage-listing] unhandled error:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: detail,
      stack: error instanceof Error ? error.stack : null,
    });
    return json({
      error: "İlan işlemi tamamlanamadı. Lütfen tekrar deneyin.",
      detail: detail.slice(0, 500),
    }, 500);
  }
});
