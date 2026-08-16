import type { MetadataRoute } from "next";
import { CONCURSO_ENABLED } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.zafe.app.br";

// O SITEMAP SEGUE AS FLAGS, NÃO A LISTA DE ARQUIVOS.
//
// `/concurso` ficou aqui com prioridade 0.9 — dizendo ao Google "esta é a
// segunda página mais importante do site" — enquanto o middleware devolve 307
// para a home, porque `CONCURSO_ENABLED` é false. É por isso que quem procura
// "zafe" ainda acha o Concurso: nós mesmos submetemos a URL. Rota atrás de flag
// sai daqui junto com a flag.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`,          lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/liga`,      lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    ...(CONCURSO_ENABLED
      ? [{ url: `${BASE_URL}/concurso`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 }]
      : []),
    { url: `${BASE_URL}/ranking`,   lastModified: new Date(), changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE_URL}/historico`, lastModified: new Date(), changeFrequency: "weekly",  priority: 0.5 },
    { url: `${BASE_URL}/ajuda`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/paginas`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/jogo-responsavel`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/contato`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/termos`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE_URL}/politica`,  lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
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
      const slug = (t as any).slug ?? t.id;
      return {
        url: `${BASE_URL}/liga/${slug}`,
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
