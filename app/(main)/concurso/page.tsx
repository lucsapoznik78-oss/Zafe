export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, Medal, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TopicWithStats } from "@/types/database";
import TopicCard from "@/components/topicos/TopicCard";
import SearchBar from "@/components/topicos/SearchBar";
import TopicFilters from "@/components/topicos/TopicFilters";
import { Suspense } from "react";
import LegalFooter from "@/components/layout/LegalFooter";
import EnrollButton from "@/components/concurso/EnrollButton";
import RankingList from "@/components/concurso/RankingList";

export const metadata: Metadata = {
  title: "Concurso — Zafe Liga",
  description: "Compita com palpites virtuais (ZC$) e ganhe prêmios reais em dinheiro.",
};

interface PageProps {
  searchParams: Promise<{ tab?: string; category?: string; search?: string }>;
}

const PREMIOS = [
  { pos: "1º", valor: "R$ 1.000" },
  { pos: "2º", valor: "R$ 500" },
  { pos: "3º", valor: "R$ 250" },
  { pos: "4º–10º", valor: "R$ 100 cada" },
  { pos: "11º–25º", valor: "R$ 35 cada" },
];

async function EventosConcurso({ category, search, tab }: { category: string; search: string; tab: string }) {
  const supabase = await createClient();
  const isEncerrados = tab === "encerrados";

  let query = supabase
    .from("topics")
    .select("*, creator:profiles!creator_id(id, username, full_name)")
    .eq("is_private", false)
    .neq("category", "economia");

  if (isEncerrados) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.eq("status", "resolved").gte("resolved_at", oneWeekAgo);
  } else {
    query = query.eq("status", "active").gte("closes_at", new Date().toISOString());
  }

  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("title", `%${search}%`);
  query = query.order("created_at", { ascending: false }).limit(50);

  const { data: topics } = await query;
  if (!topics || topics.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-white font-medium mb-1">
          {isEncerrados ? "Nenhum evento encerrado" : "Nenhum evento disponível"}
        </p>
        <p className="text-sm">Tente outros filtros ou aguarde novos eventos</p>
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
  const snapMap = new Map<string, number>();
  for (const snap of snapshotsData ?? []) {
    if (!snapMap.has(snap.topic_id)) snapMap.set(snap.topic_id, snap.prob_sim);
  }

  const enriched = topics
    .map((t) => ({ ...t, stats: statsMap.get(t.id) ?? null, latestSnapshotProb: snapMap.get(t.id) ?? 0.5 }))
    .sort((a, b) => (b.stats?.total_volume ?? 0) - (a.stats?.total_volume ?? 0));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {enriched.map((topic) => (
        <Link key={topic.id} href={`/concurso/${topic.id}`} className="block">
          {/* Wrapper amarelo sobre o TopicCard */}
          <div className="relative rounded-xl ring-1 ring-yellow-400/20 hover:ring-yellow-400/50 transition-all">
            <TopicCard topic={topic as TopicWithStats} />
            <div className="absolute bottom-2 left-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                ZC$
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function ConcursoPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.tab ?? "eventos";
  const category = params.category ?? "";
  const search = params.search ?? "";
  const now = new Date().toISOString();

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: concurso } = await admin
    .from("concursos")
    .select("*")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  if (!concurso) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <Trophy size={40} className="mx-auto mb-3 text-yellow-400/40" />
        <p className="text-white font-semibold mb-1">Nenhum concurso ativo</p>
        <p className="text-sm">O próximo concurso será anunciado em breve.</p>
        <Link href="/liga" className="mt-4 inline-block text-sm text-yellow-400 hover:underline">
          Jogar na Liga →
        </Link>
      </div>
    );
  }

  let enrolled = false;
  let walletBalance = 0;

  if (user) {
    const [{ data: inscricao }, { data: wallet }] = await Promise.all([
      admin.from("inscricoes_concurso")
        .select("id").eq("user_id", user.id).eq("concurso_id", concurso.id).single(),
      admin.from("concurso_wallets")
        .select("balance").eq("user_id", user.id).eq("concurso_id", concurso.id).single(),
    ]);
    enrolled = !!inscricao;
    walletBalance = wallet?.balance ?? 0;
  }

  const tabs = [
    { key: "eventos", label: "Eventos" },
    { key: "ranking", label: "Ranking" },
    { key: "encerrados", label: "Encerrados" },
  ];

  const buildHref = (key: string) =>
    `/concurso?tab=${key}${category ? `&category=${category}` : ""}${search ? `&search=${search}` : ""}`;

  return (
    <div className="py-6 space-y-5">
      {/* Header do concurso */}
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} className="text-yellow-400" />
              <h1 className="text-lg font-bold text-yellow-400">{concurso.titulo}</h1>
            </div>
            <p className="text-xs text-yellow-300/60">{concurso.descricao}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-yellow-300/50">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {format(new Date(concurso.periodo_inicio), "dd/MM", { locale: ptBR })} –{" "}
                {format(new Date(concurso.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Medal size={11} />
                R$ {Number(concurso.premiacao_total).toLocaleString("pt-BR")} em prêmios
              </span>
            </div>
          </div>

          {/* Status do usuário */}
          {user ? (
            enrolled ? (
              <div className="text-right shrink-0">
                <p className="text-xs text-yellow-300/60 mb-0.5">Seu saldo ZC$</p>
                <p className="text-2xl font-bold text-yellow-400">ZC$ {walletBalance.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                <p className="text-[10px] text-yellow-300/40 mt-0.5">Iniciou com ZC$ {concurso.saldo_inicial}</p>
              </div>
            ) : (
              <EnrollButton />
            )
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 transition-colors"
            >
              Entrar para participar
            </Link>
          )}
        </div>

        {/* Prêmios */}
        <div className="border-t border-yellow-400/20 pt-3">
          <p className="text-[10px] text-yellow-300/50 mb-2 font-semibold uppercase tracking-wide">Premiação</p>
          <div className="flex flex-wrap gap-2">
            {PREMIOS.map((p) => (
              <div key={p.pos} className="px-2 py-1 rounded bg-yellow-400/10 border border-yellow-400/20">
                <span className="text-[10px] text-yellow-400 font-bold">{p.pos}</span>
                <span className="text-[10px] text-yellow-300/60 ml-1">{p.valor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={buildHref(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? "bg-yellow-400/20 text-yellow-400" : "text-muted-foreground hover:text-white"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <Link
          href="/liga"
          className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-white border border-border hover:border-primary/40 transition-all"
        >
          ← Jogar na Liga (Z$)
        </Link>
      </div>

      {tab === "ranking" ? (
        <Suspense fallback={<div className="animate-pulse bg-card rounded-xl h-64" />}>
          <RankingList concursoId={concurso.id} />
        </Suspense>
      ) : (
        <>
          <SearchBar />
          <Suspense fallback={null}>
            <TopicFilters excludeCategory="economia" />
          </Suspense>
          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-40" />
                ))}
              </div>
            }
          >
            <EventosConcurso
              category={category}
              search={search}
              tab={tab === "encerrados" ? "encerrados" : "abertos"}
            />
          </Suspense>
        </>
      )}

      <LegalFooter />
    </div>
  );
}
