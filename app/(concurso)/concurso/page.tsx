export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, Medal, Users, Calendar, Mail, CheckCircle2, AlertCircle } from "lucide-react";
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

const EVENT_LIST_LIMIT = 200;

export const metadata: Metadata = {
  title: "Concurso — Zafe Liga",
  description: "Compita com palpites virtuais (ZC$) e ganhe prêmios reais em dinheiro.",
  alternates: { canonical: "/concurso" },
};

interface PageProps {
  searchParams: Promise<{ tab?: string; category?: string; search?: string }>;
}

const PREMIOS = [
  { pos: "1º", valor: "R$ 200" },
  { pos: "2º", valor: "R$ 150" },
  { pos: "3º", valor: "R$ 100" },
  { pos: "4º–5º", valor: "R$ 25 cada" },
];

async function EventosConcurso({ category, search, tab, concurso, now }: { category: string; search: string; tab: string; concurso: any; now: string }) {
  const supabase = await createClient();
  const isEncerrados = tab === "encerrados";

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

  let query = supabase
    .from("topics")
    .select("*, creator:profiles!creator_id(id, username, full_name)")
    .eq("concurso_id", concurso.id)
    .eq("is_private", false);

  if (isEncerrados) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.eq("status", "resolved").gte("resolved_at", oneWeekAgo);
  } else {
    query = query.eq("status", "active").gte("closes_at", new Date().toISOString());
  }

  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("title", `%${search}%`);
  query = query.order("created_at", { ascending: false }).limit(EVENT_LIST_LIMIT);

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
  const admin = createAdminClient();
  // Volume/odds dos cards vêm de concurso_bets (ZC$), não de v_topic_stats
  // (que só conta a tabela `bets` da Liga, em Z$). Sem isso, evento com
  // palpite no concurso aparece zerado no card.
  const [{ data: betRows }, { data: snapshotsData }] = await Promise.all([
    admin
      .from("concurso_bets")
      .select("topic_id, side, amount")
      .eq("concurso_id", concurso.id)
      .in("topic_id", topicIds)
      .eq("status", "matched"),
    supabase
      .from("v_latest_topic_snapshots")
      .select("topic_id, prob_sim")
      .in("topic_id", topicIds),
  ]);

  const statsMap = new Map<string, any>();
  for (const id of topicIds) {
    statsMap.set(id, { topic_id: id, volume_sim: 0, volume_nao: 0, total_volume: 0, prob_sim: 0.5, bet_count: 0 });
  }
  for (const b of betRows ?? []) {
    const s = statsMap.get(b.topic_id);
    if (!s) continue;
    const amt = Number(b.amount);
    s.total_volume += amt;
    s.bet_count += 1;
    if (b.side === "sim") s.volume_sim += amt;
    else if (b.side === "nao") s.volume_nao += amt;
  }
  for (const s of statsMap.values()) {
    s.prob_sim = s.total_volume > 0 ? s.volume_sim / s.total_volume : 0.5;
  }

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
        // Wrapper amarelo sobre o TopicCard. O link fica DENTRO do próprio
        // TopicCard (via prop href) — nunca aninhar <a> dentro de <a>, senão o
        // navegador segue o link interno (/liga) e o palpite cai no fluxo Z$.
        <div key={topic.id} className="relative rounded-xl ring-1 ring-yellow-400/20 hover:ring-yellow-400/50 transition-all">
          <TopicCard topic={topic as TopicWithStats} href={`/concurso/${topic.id}`} />
          <div className="absolute bottom-2 left-2 pointer-events-none">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
              ZC$
            </span>
          </div>
        </div>
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-full bg-yellow-400 text-black text-xs font-extrabold uppercase tracking-wide">
              <Calendar size={12} />
              Concurso de {(() => {
                const s = format(new Date(concurso.periodo_inicio), "MMMM 'de' yyyy", { locale: ptBR });
                return s.charAt(0).toUpperCase() + s.slice(1);
              })()}
            </span>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} className="text-yellow-400" />
              <h1 className="text-lg font-bold text-yellow-400">{concurso.titulo}</h1>
            </div>
            <p className="text-xs text-yellow-300/60">{concurso.descricao}</p>
            <p className="text-[11px] text-yellow-300/50 mt-1">
              Toda virada de mês o concurso recomeça: saldo ZC$ renovado e ranking zerado.
            </p>
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-1 rounded-full bg-yellow-400/20 border border-yellow-400/30 text-[10px] font-bold text-yellow-400">
                  <CheckCircle2 size={11} /> Você está participando
                </span>
                <p className="text-xs text-yellow-300/60 mb-0.5">Seu saldo ZC$</p>
                <p className="text-2xl font-bold text-yellow-400">ZC$ {walletBalance.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                <p className="text-[10px] text-yellow-300/40 mt-0.5">Iniciou com ZC$ {concurso.saldo_inicial}</p>
              </div>
            ) : (
              <div className="shrink-0 text-right space-y-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-[10px] font-semibold text-muted-foreground">
                  <AlertCircle size={11} /> Você ainda não está participando
                </span>
                <EnrollButton saldoInicial={concurso.saldo_inicial} />
              </div>
            )
          ) : (
            <div className="shrink-0 text-right space-y-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-[10px] font-semibold text-muted-foreground">
                <AlertCircle size={11} /> Você ainda não está participando
              </span>
              <Link
                href="/concurso/entrar"
                className="block px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 transition-colors"
              >
                Entrar para participar
              </Link>
            </div>
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
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 px-3 py-2">
            <Mail size={14} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-yellow-300/70 leading-relaxed">
              Ao fim do concurso, quem ficar no <span className="font-semibold text-yellow-400">topo do ranking (top 5%)</span> receberá
              um email com os detalhes de como resgatar o prêmio em dinheiro. Mantenha o email da sua conta atualizado.
            </p>
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
            <TopicFilters />
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
              concurso={concurso}
              now={now}
            />
          </Suspense>
        </>
      )}

      <LegalFooter />
    </div>
  );
}
