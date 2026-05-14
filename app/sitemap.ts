import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe-rho.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`,          lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/liga`,      lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/economico`, lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/ranking`,   lastModified: new Date(), changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/historico`, lastModified: new Date(), changeFrequency: "weekly",  priority: 0.5 },
    { url: `${BASE_URL}/termos`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const supabase = await createClient();
    const { data: topics } = await supabase
      .from("topics")
      .select("id, slug, category, created_at, closes_at")
      .eq("is_private", false)
      .eq("status", "active")
      .is("concurso_id", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const topicRoutes: MetadataRoute.Sitemap = (topics ?? []).map((t) => {
      const base = t.category === "economia" ? "economico" : "liga";
      const slug = (t as any).slug ?? t.id;
      return {
        url: `${BASE_URL}/${base}/${slug}`,
        lastModified: new Date(t.created_at),
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    });

    return [...staticRoutes, ...topicRoutes];
  } catch {
    return staticRoutes;
  }
}
