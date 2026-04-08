import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";

const BASE_URL = "https://zafe-rho.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

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

  const topicUrls: MetadataRoute.Sitemap = (topics ?? []).map((t) => ({
    url: `${BASE_URL}/topicos/${t.id}`,
    lastModified: new Date(t.updated_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const profileUrls: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `${BASE_URL}/u/${p.username}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/topicos`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/ranking`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    ...topicUrls,
    ...profileUrls,
  ];
}
