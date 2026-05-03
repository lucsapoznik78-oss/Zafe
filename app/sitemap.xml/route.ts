/**
 * GET /sitemap.xml
 * Dynamic route handler so this runs at request time (not build time),
 * giving the admin client access to SUPABASE_SERVICE_ROLE_KEY.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe-rho.vercel.app";

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
      .select("id, created_at")
      .eq("is_private", false)
      .in("status", ["active", "resolved"])
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("profiles")
      .select("username, created_at")
      .not("username", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const topicEntries = (topics ?? []).map((t) =>
    urlEntry(`${BASE_URL}/liga/${t.id}`, new Date(t.created_at).toISOString(), "daily", 0.8)
  );

  const profileEntries = (profiles ?? [])
    .filter((p) => p.username)
    .map((p) =>
      urlEntry(`${BASE_URL}/u/${p.username}`, new Date(p.created_at).toISOString(), "weekly", 0.5)
    );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntry(BASE_URL, now, "daily", 1)}
${urlEntry(`${BASE_URL}/liga`, now, "hourly", 0.9)}
${urlEntry(`${BASE_URL}/concurso`, now, "daily", 0.9)}
${urlEntry(`${BASE_URL}/economico`, now, "daily", 0.8)}
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
