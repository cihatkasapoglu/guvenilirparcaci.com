import { createClient } from "npm:@supabase/supabase-js@2";

const origin = (Deno.env.get("SITE_ORIGIN") || "https://guvenilirparcaci.com").replace(/\/$/, "");
const headers = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=900, s-maxage=3600",
  "X-Content-Type-Options": "nosniff",
};
const PAGE_SIZE = 10000;
const DB_BATCH = 1000;

function xml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[char]!);
}
function xmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers });
}
function sitemapUrl(path: string) {
  return origin + path;
}
function listingPath(id: string, slug: string) {
  return "/ilan/" + encodeURIComponent(id) + "/" + encodeURIComponent(slug || "yedek-parca-ilani");
}
function lastmod(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function urlEntry(loc: string, modified?: string | null) {
  return "<url><loc>" + xml(loc) + "</loc>" +
    (modified ? "<lastmod>" + xml(lastmod(modified)) + "</lastmod>" : "") +
    "</url>";
}
function indexEntry(loc: string) {
  return "<sitemap><loc>" + xml(loc) + "</loc></sitemap>";
}

Deno.serve(async (request) => {
  if (request.method !== "GET") return xmlResponse("Method not allowed", 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return xmlResponse("Sitemap configuration missing", 503);

    // Use the public anon role, not the service role. Database RLS therefore
    // excludes listings whose firm membership is inactive or whose listing expired.
    const db = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const requestUrl = new URL(request.url);
    const type = requestUrl.searchParams.get("type") || "index";
    const page = Number(requestUrl.searchParams.get("page") || "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      return xmlResponse("Invalid sitemap page", 400);
    }

    if (type === "index") {
      const [{ count: listingCount, error: listingError }, { count: firmCount, error: firmError }, { count: catalogCount, error: catalogError }] = await Promise.all([
        db.from("listings").select("id", { count: "exact", head: true })
          .eq("status", "published").gt("expires_at", new Date().toISOString()),
        db.from("public_firm_directory").select("id", { count: "exact", head: true }),
      ]);
      if (listingError || firmError) return xmlResponse("Could not count public sitemap records", 503);
      const listingPages = Math.ceil((listingCount || 0) / PAGE_SIZE);
      const firmPages = Math.ceil((firmCount || 0) / PAGE_SIZE);
      const entries = [
        indexEntry(sitemapUrl("/sitemap-static.xml")),
        ...Array.from({ length: listingPages }, (_, i) =>
          indexEntry(sitemapUrl("/sitemap-listings.xml?page=" + (i + 1)))),
        ...Array.from({ length: firmPages }, (_, i) =>
          indexEntry(sitemapUrl("/sitemap-firms.xml?page=" + (i + 1)))),
      ];
      return xmlResponse('<?xml version="1.0" encoding="UTF-8"?>' +
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        entries.join("") + "</sitemapindex>");
    }

    if (type === "catalog") {
      const [categories, brands, models] = await Promise.all([
        db.from("categories").select("slug").eq("is_active", true).order("slug"),
        db.from("vehicle_brands").select("slug,updated_at").eq("is_active", true).order("slug"),
        db.from("vehicle_models").select("id,slug").eq("is_active", true).order("id"),
      ]);
      if (categories.error || brands.error || models.error) {
        return xmlResponse("Could not load public catalogue", 503);
      }
      const entries = [
        ...(categories.data || []).map((row) =>
          urlEntry(sitemapUrl("/marketplace/kategori.html?slug=" + encodeURIComponent(row.slug)))),
        ...(brands.data || []).map((row) =>
          urlEntry(sitemapUrl("/marketplace/marka.html?slug=" + encodeURIComponent(row.slug)), row.updated_at)),
        ...(models.data || []).map((row) =>
          urlEntry(sitemapUrl("/marketplace/model.html?id=" + encodeURIComponent(row.id)))),
      ];
      return xmlResponse('<?xml version="1.0" encoding="UTF-8"?>' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        entries.join("") + "</urlset>");
    }

    if (type === "listings" || type === "firms") {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const entries: string[] = [];
      for (let offset = from; offset <= to;) {
        const end = Math.min(offset + DB_BATCH - 1, to);
        if (type === "listings") {
          const { data, error } = await db.from("listings")
            .select("id,slug,updated_at,published_at")
            .eq("status", "published")
            .gt("expires_at", new Date().toISOString())
            .order("id", { ascending: true })
            .range(offset, end);
          if (error) return xmlResponse("Could not load public listings", 503);
          for (const row of data || []) {
            entries.push(urlEntry(sitemapUrl(listingPath(row.id, row.slug)), row.updated_at || row.published_at));
          }
          if (!data || data.length === 0) break;
          offset += data.length;
        } else {
          const { data, error } = await db.from("public_firm_directory")
            .select("slug,created_at")
            .order("slug", { ascending: true })
            .range(offset, end);
          if (error) return xmlResponse("Could not load public firms", 503);
          for (const row of data || []) {
            if (row.slug) entries.push(urlEntry(sitemapUrl("/" + row.slug), row.created_at));
          }
          if (!data || data.length === 0) break;
          offset += data.length;
        }
      }
      return xmlResponse('<?xml version="1.0" encoding="UTF-8"?>' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        entries.join("") + "</urlset>");
    }
    return xmlResponse("Unknown sitemap type", 400);
  } catch (_error) {
    return xmlResponse("Sitemap generation failed", 500);
  }
});
