export async function proxySitemap(request: Request, env: { SUPABASE_URL?: string }, type: "index" | "listings" | "firms") {
  const base = env.SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return new Response("Sitemap is not configured", { status: 503 });
  const incoming = new URL(request.url);
  const target = new URL(base + "/functions/v1/public-sitemap");
  if (type !== "index") {
    target.searchParams.set("type", type);
    const page = incoming.searchParams.get("page");
    if (page) target.searchParams.set("page", page);
  }
  try {
    const response = await fetch(target.toString(), { headers: { "Accept": "application/xml" } });
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/xml; charset=utf-8",
        "Cache-Control": response.headers.get("Cache-Control") || "public, max-age=900, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Sitemap service unavailable", { status: 502 });
  }
}
