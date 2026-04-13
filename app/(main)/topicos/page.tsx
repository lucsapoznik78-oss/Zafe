export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mercados",
  description: "Aposte em eventos políticos, esportivos e econômicos com outros usuários brasileiros. Prediction markets em tempo real no Zafe.",
  openGraph: {
    title: "Mercados — Zafe",
    description: "Aposte em eventos políticos, esportivos e econômicos com outros usuários brasileiros. Prediction markets em tempo real.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mercados — Zafe",
    description: "Aposte em eventos políticos, esportivos e econômicos com outros usuários brasileiros.",
  },
};
import TopicCard from "@/components/topicos/TopicCard";
import TopicFilters from "@/components/topicos/TopicFilters";
import SearchBar from "@/components/topicos/SearchBar";
import Link from "next/link";
import LegalFooter from "@/components/layout/LegalFooter";
import type { TopicWithStats } from "@/types/database";
import { Suspense } from "react";

interface PageProps {
  searchParams: Promise<{ sort?: string; category?: string; search?: string; tab?: string }>;
}

async function TrendingList() {
  const supabase = await createClient();

  // Volume apostado nas últimas 2 horas por tópico
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: recentBets } = await supabase
    .from("bets")
    .select("topic_id, matched_amount")
    .gte("created_at", twoHoursAgo)
    .not("status", "in", '("refunded")');

  // Agrupa volume por topic_id
  const vol2hMap = new Map<string, number>();
  for (const b of recentBets ?? []) {
    if (!b.topic_id) continue;
    vol2hMap.set(b.topic_id, (vol2hMap.get(b.topic_id) ?? 0) + parseFloat(b.matched_amount ?? 0));
  }

  if (vol2hMap.size === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-2xl mb-2">📊</p>
        <p className="text-sm font-medium text-white">Nenhuma aposta nas últimas 2 horas</p>
        <p className="text-xs mt-1">Volte mais tarde — o feed aquece com apostas em tempo real.</p>
      </div>
    );
  }

  const trendingIds = [...vol2hMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id]) => id);

  const { data: topics } = await supabase
    .from("topics")
    .select("*, creator:profiles!creator_id(id, username, full_name)")
    .in("id", trendingIds)
    .eq("status", "active");

  if (!topics || topics.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-sm">Nenhum tópico ativo em alta agora.</p>
      </div>
    );
  }

  const { data: statsData } = await supabase
    .from("v_topic_stats")
    .select("*")
    .in("topic_id", trendingIds);

  const statsMap = new Map((statsData ?? []).map((s: any) => [s.topic_id, s]));

  const enriched = topics
    .map((t) => ({
      ...t,
      stats: statsMap.get(t.id) ?? null,
      latestSnapshotProb: statsMap.get(t.id)?.prob_sim ?? 0.5,
      vol2h: vol2hMap.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.vol2h - a.vol2h);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Eventos com mais volume apostado nas últimas 2 horas — atualizado em tempo real.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {enriched.map((topic, i) => (
          <div key={topic.id} className="relative">
            {i < 3 && (
              <div className="absolute -top-2 -left-2 z-10 bg-primary text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                #{i + 1}
              </div>
            )}
            <div className="absolute -top-2 right-2 z-10 bg-card border border-border text-[10px] text-primary font-semibold px-2 py-0.5 rounded-full">
              +Z$ {topic.vol2h.toFixed(0)} / 2h
            </div>
            <TopicCard topic={topic as TopicWithStats} />
          </div>
        ))}
      </div>
    </div>
  );
}

async function TopicList({
  sort, category, search, tab,
}: {
  sort: string; category: string; search: string; tab: string;
}) {
  const supabase = await createClient();

  const isEncerrados = tab === "encerrados";

  let query = supabase
    .from("topics")
    .select("*, creator:profiles!creator_id(id, username, full_name)")
    .eq("is_private", false);

  if (isEncerrados) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.eq("status", "resolved").gte("resolved_at", oneWeekAgo);
  } else {
    query = query.eq("status", "active").gte("closes_at", new Date().toISOString());
  }

  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("title", `%${search}%`);
  query = query.order("created_at", { ascending: false }).limit(50);

  const { data: topics, error } = await query;

  if (error || !topics || topics.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium text-white mb-1">
          {isEncerrados ? "Nenhum mercado encerrado" : "Nenhum tópico encontrado"}
        </p>
        <p className="text-sm">
          {isEncerrados ? "Mercados resolvidos aparecerão aqui" : "Tente outros filtros ou crie um novo tópico"}
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

  const enriched = topics.map((t) => ({
    ...t,
    stats: statsMap.get(t.id) ?? null,
    latestSnapshotProb: latestSnapshotMap.get(t.id) ?? 0.5,
  }));

  enriched.sort((a, b) => {
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

export default async function TopicosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sort = params.sort ?? "popular";
  const category = params.category ?? "";
  const search = params.search ?? "";
  const tab = params.tab ?? "abertos";

  const tabs = [
    { key: "abertos", label: "Abertos" },
    { key: "em-alta", label: "Em Alta 🔥" },
    { key: "encerrados", label: "Encerrados" },
  ];

  const buildHref = (key: string) =>
    `/topicos?tab=${key}${sort !== "popular" ? `&sort=${sort}` : ""}${category ? `&category=${category}` : ""}${search ? `&search=${search}` : ""}`;

  return (
    <div className="py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Mercados</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Invista em eventos reais com outros usuários</p>
      </div>

      {/* Tabs */}
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

      {tab !== "em-alta" && (
        <>
          <SearchBar />
          <Suspense fallback={null}>
            <TopicFilters />
          </Suspense>
        </>
      )}

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-40" />
            ))}
          </div>
        }
      >
        {tab === "em-alta"
          ? <TrendingList />
          : <TopicList sort={sort} category={category} search={search} tab={tab} />
        }
      </Suspense>

      <LegalFooter />
    </div>
  );
}
