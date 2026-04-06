import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";

const BASE_URL = "https://zafe-rho.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const { data: topics } = await supabase
    .from("topics")
    .select("id, updated_at")
    .eq("is_private", false)
    .in("status", ["active", "resolved"])
    .order("updated_at", { ascending: false })
    .limit(1000);

  const topicUrls: MetadataRoute.Sitemap = (topics ?? []).map((t) => ({
    url: `${BASE_URL}/topicos/${t.id}`,
    lastModified: new Date(t.updated_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/topicos`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/ranking`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    ...topicUrls,
  ];
}
