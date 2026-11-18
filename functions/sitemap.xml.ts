import { proxySitemap } from "./_shared/sitemap-proxy";
export const onRequestGet: PagesFunction<{ SUPABASE_URL?: string }> = ({ request, env }) => proxySitemap(request, env, "index");
