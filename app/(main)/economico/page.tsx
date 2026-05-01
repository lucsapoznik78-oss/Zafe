export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopicCard from "@/components/topicos/TopicCard";
import SearchBar from "@/components/topicos/SearchBar";
import Link from "next/link";
import LegalFooter from "@/components/layout/LegalFooter";
import type { TopicWithStats } from "@/types/database";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Econômico — Zafe",
  description: "Palpites em indicadores econômicos: IPCA, Selic, PIB e outros eventos do mercado financeiro.",
  openGraph: {
    title: "Econômico — Zafe",
    description: "Palpites em indicadores econômicos: IPCA, Selic, PIB e outros eventos do mercado financeiro.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Econômico — Zafe",
    description: "Palpites em indicadores econômicos: IPCA, Selic, PIB e outros eventos do mercado financeiro.",
  },
};

interface PageProps {
  searchParams: Promise<{ search?: string; tab?: string }>;
}

async function EconomicoList({ search, tab }: { search: string; tab: string }) {
  const supabase = await createClient();
  const isEncerrados = tab === "encerrados";

  let query = supabase
    .from("topics")
    .select("*, creator:profiles!creator_id(id, username, full_name)")
    .eq("is_private", false)
    .eq("category", "economia");

  if (isEncerrados) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.eq("status", "resolved").gte("resolved_at", oneWeekAgo);
  } else {
    query = query.eq("status", "active").gte("closes_at", new Date().toISOString());
  }

  if (search) query = query.ilike("title", `%${search}%`);
  query = query.order("created_at", { ascending: false }).limit(50);

  const { data: topics, error } = await query;

  if (error || !topics || topics.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium text-white mb-1">
          {isEncerrados ? "Nenhum evento encerrado" : "Nenhum evento econômico disponível"}
        </p>
        <p className="text-sm">
          {isEncerrados ? "Eventos resolvidos aparecerão aqui" : "Novos indicadores econômicos são adicionados periodicamente"}
        </p>
      </div>
    );
  }

  const topicIds = topics.map((t) => t.id);
  const [{ data: statsData }, { data: snapshotsData }] = await Promise.all([
    supabase.from("v_topic_stats").select("*").in("topic_id", topicIds),
    supabase
      .from("topic_snapshots")
      .select("topic_id, prob_sim, recorded_at")
      .in("topic_id", topicIds)
      .order("recorded_at", { ascending: false })
      .limit(topicIds.length * 2),
  ]);

  const statsMap = new Map((statsData ?? []).map((s: any) => [s.topic_id, s]));
  const latestSnapshotMap = new Map<string, number>();
  for (const snap of snapshotsData ?? []) {
    if (!latestSnapshotMap.has(snap.topic_id)) {
      latestSnapshotMap.set(snap.topic_id, snap.prob_sim);
    }
  }

  const enriched = topics
    .map((t) => ({
      ...t,
      stats: statsMap.get(t.id) ?? null,
      latestSnapshotProb: latestSnapshotMap.get(t.id) ?? 0.5,
    }))
    .sort((a, b) => {
      const volDiff = (b.stats?.total_volume ?? 0) - (a.stats?.total_volume ?? 0);
      if (volDiff !== 0) return volDiff;
      return new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime();
    });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {enriched.map((topic) => (
        <TopicCard key={topic.id} topic={topic as TopicWithStats} />
      ))}
    </div>
  );
}

export default async function EconomicoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search ?? "";
  const tab = params.tab ?? "abertos";

  const tabs = [
    { key: "abertos", label: "Abertos" },
    { key: "encerrados", label: "Encerrados" },
  ];

  const buildHref = (key: string) =>
    `/economico?tab=${key}${search ? `&search=${search}` : ""}`;

  return (
    <div className="py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Econômico</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Indicadores econômicos: IPCA, Selic, PIB e mais</p>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={buildHref(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? "bg-card text-white" : "text-muted-foreground hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <SearchBar />

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-40" />
            ))}
          </div>
        }
      >
        <EconomicoList search={search} tab={tab} />
      </Suspense>

      <LegalFooter />
    </div>
  );
}
