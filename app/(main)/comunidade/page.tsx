export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import CommunityEventCard from "@/components/comunidade/CommunityEventCard";
import Link from "next/link";
import LegalFooter from "@/components/layout/LegalFooter";
import { Suspense } from "react";
import { Plus, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Comunidade — Zafe",
  description: "Eventos criados e resolvidos pela galera. Pura diversão com Z$ virtual.",
};

interface PageProps {
  searchParams: Promise<{ tab?: string; category?: string; search?: string; min_score?: string }>;
}

async function CommunityList({ tab, category, search, minScore }: { tab: string; category: string; search: string; minScore: number }) {
  const admin = createAdminClient();
  const isEncerrados = tab === "encerrados";

  let query = admin
    .from("community_events")
    .select("*, creator:profiles!creator_id(id, username, full_name)");

  if (isEncerrados) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.in("status", ["community_resolved", "auto_cancelled", "mod_cancelled"]).gte("resolved_at", oneWeekAgo);
  } else {
    query = query.eq("status", "active").gte("closes_at", new Date().toISOString());
  }

  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("title", `%${search}%`);
  query = query.order("created_at", { ascending: false }).limit(100);

  const { data: events } = await query;

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium text-white mb-1">
          {isEncerrados ? "Nenhum evento encerrado" : "Nenhum evento encontrado"}
        </p>
        <p className="text-sm">
          {isEncerrados ? "Eventos resolvidos aparecerão aqui" : "Que tal criar o primeiro?"}
        </p>
      </div>
    );
  }

  // Fetch stats and reputations
  const eventIds = events.map((e) => e.id);
  const creatorIds = [...new Set(events.map((e) => e.creator_id))];

  const [{ data: statsData }, { data: repData }] = await Promise.all([
    admin.from("v_community_event_stats").select("*").in("event_id", eventIds),
    admin.from("creator_reputation").select("user_id, score").in("user_id", creatorIds),
  ]);

  const statsMap = new Map((statsData ?? []).map((s: any) => [s.event_id, s]));
  const repMap = new Map((repData ?? []).map((r: any) => [r.user_id, r]));

  let enriched = events.map((e) => ({
    ...e,
    stats: statsMap.get(e.id) ?? null,
    creator_reputation: repMap.get(e.creator_id) ?? { score: 50 },
  }));

  // Filter by min score
  if (minScore > 0) {
    enriched = enriched.filter((e) => (e.creator_reputation?.score ?? 50) >= minScore);
  }

  // Sort by volume desc
  enriched.sort((a, b) => (b.stats?.total_volume ?? 0) - (a.stats?.total_volume ?? 0));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {enriched.map((event) => (
        <CommunityEventCard key={event.id} event={event as any} />
      ))}
    </div>
  );
}

export default async function ComunidadePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.tab ?? "abertos";
  const category = params.category ?? "";
  const search = params.search ?? "";
  const minScore = parseInt(params.min_score ?? "0") || 0;

  const tabs = [
    { key: "abertos", label: "Abertos" },
    { key: "encerrados", label: "Encerrados" },
  ];

  const scoreFilters = [
    { value: 0, label: "Todos" },
    { value: 70, label: "Nota 70+" },
    { value: 90, label: "Nota 90+" },
  ];

  const buildHref = (key: string) =>
    `/comunidade?tab=${key}${category ? `&category=${category}` : ""}${search ? `&search=${search}` : ""}${minScore ? `&min_score=${minScore}` : ""}`;

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Comunidade</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Eventos criados e resolvidos pela galera</p>
        </div>
        <Link
          href="/comunidade/criar"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Criar evento
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2.5">
        <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
        <p className="text-xs text-yellow-200/80">
          Estes eventos são criados e resolvidos por usuários. A Zafe não garante a veracidade do resultado.
        </p>
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

      {/* Score filters */}
      <div className="flex gap-2 flex-wrap">
        {scoreFilters.map((f) => (
          <Link
            key={f.value}
            href={`/comunidade?tab=${tab}${category ? `&category=${category}` : ""}${f.value ? `&min_score=${f.value}` : ""}`}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              minScore === f.value
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground hover:text-white"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-dashed border-border rounded-xl p-4 animate-pulse h-40" />
            ))}
          </div>
        }
      >
        <CommunityList tab={tab} category={category} search={search} minScore={minScore} />
      </Suspense>

      <LegalFooter />
    </div>
  );
}
