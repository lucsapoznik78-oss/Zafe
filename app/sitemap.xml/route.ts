/**
 * GET /sitemap.xml
 * Dynamic route handler so this runs at request time (not build time),
 * giving the admin client access to SUPABASE_SERVICE_ROLE_KEY.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BASE_URL = "https://zafe-rho.vercel.app";

function urlEntry(loc: string, lastmod: string, freq: string, priority: number) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function GET() {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const [{ data: topics }, { data: profiles }] = await Promise.all([
    supabase
      .from("topics")
      .select("id, updated_at")
      .eq("is_private", false)
      .in("status", ["active", "resolved"])
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("profiles")
      .select("username, updated_at")
      .not("username", "is", null)
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  const topicEntries = (topics ?? []).map((t) =>
    urlEntry(`${BASE_URL}/topicos/${t.id}`, new Date(t.updated_at).toISOString(), "daily", 0.8)
  );

  const profileEntries = (profiles ?? [])
    .filter((p) => p.username)
    .map((p) =>
      urlEntry(`${BASE_URL}/u/${p.username}`, new Date(p.updated_at).toISOString(), "weekly", 0.5)
    );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntry(BASE_URL, now, "daily", 1)}
${urlEntry(`${BASE_URL}/topicos`, now, "hourly", 0.9)}
${urlEntry(`${BASE_URL}/ranking`, now, "daily", 0.6)}
${topicEntries.join("\n")}
${profileEntries.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
