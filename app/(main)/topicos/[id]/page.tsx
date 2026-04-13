export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

import CategoryBadge from "@/components/topicos/CategoryBadge";
import BetForm from "@/components/topicos/BetForm";
import CommentSection from "@/components/topicos/CommentSection";
import CountdownTimer from "@/components/topicos/CountdownTimer";
import MercadoSecundario from "@/components/topicos/MercadoSecundario";
import SocialActivity from "@/components/topicos/SocialActivity";
import ProbabilityChart from "@/components/topicos/ProbabilityChart";
import LiveStats from "@/components/topicos/LiveStats";
import ShareButton from "@/components/topicos/ShareButton";
import UserResultBanner from "@/components/topicos/UserResultBanner";
import ResolutionBreakdown from "@/components/topicos/ResolutionBreakdown";
import RulesAccordion from "@/components/topicos/RulesAccordion";
import ResolvingBanner from "@/components/topicos/ResolvingBanner";
import { formatCurrency } from "@/lib/utils";
import { calcOdds, formatOdds } from "@/lib/odds";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ side?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  // Lookup by UUID or slug
  const isUUID = /^[0-9a-f-]{36}$/.test(id);
  const query = supabase.from("topics").select("title, description, category");
  const { data: topic } = isUUID
    ? await query.eq("id", id).single()
    : await query.eq("slug", id).single();

  if (!topic) return { title: "Mercado não encontrado" };
  const desc = topic.description
    ? topic.description.slice(0, 160)
    : `Aposte no resultado deste evento de ${topic.category} no Zafe.`;
  const resolvedId = isUUID ? id : (await supabase.from("topics").select("id").eq("slug", id).single())?.data?.id ?? id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe-rho.vercel.app";
  const ogImage = `${appUrl}/api/og?id=${resolvedId}&type=topico`;
  return {
    title: topic.title,
    description: desc,
    openGraph: {
      title: `${topic.title} — Zafe`,
      description: desc,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: topic.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${topic.title} — Zafe`,
      description: desc,
      images: [ogImage],
    },
  };
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Aberto",               cls: "bg-sim/20 text-sim" },
  closed:    { label: "Fechado",              cls: "bg-yellow-500/20 text-yellow-400" },
  resolved:  { label: "Resolvido",            cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado",            cls: "bg-nao/20 text-nao" },
  pending:   { label: "Em moderação",         cls: "bg-yellow-500/20 text-yellow-400" },
  resolving: { label: "Aguardando resolução", cls: "bg-yellow-500/20 text-yellow-400" },
};

export default async function TopicoDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { side: sideParam } = await searchParams;
  const initialSide = sideParam === "sim" || sideParam === "nao" ? sideParam : undefined;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  // Lookup by UUID or slug
  const isUUID = /^[0-9a-f-]{36}$/.test(id);
  const topicQuery = admin.from("topics").select("*, creator:profiles!creator_id(id, username, full_name, avatar_url)");
  const { data: topic } = isUUID
    ? await topicQuery.eq("id", id).single()
    : await topicQuery.eq("slug", id).single();

  if (!topic) notFound();

  const topicId = topic.id;

  const [{ data: snapshots }, { data: statsData }, { data: wallet }, { data: userBets }, { data: allBets }, { data: resolucao }] =
    await Promise.all([
      admin.from("topic_snapshots").select("prob_sim, volume_sim, volume_nao, recorded_at")
        .eq("topic_id", topicId).order("recorded_at", { ascending: true }).limit(500),
      admin.from("v_topic_stats").select("*").eq("topic_id", topicId).single(),
      user
        ? supabase.from("wallets").select("balance").eq("user_id", user.id).single()
        : Promise.resolve({ data: null }),
      user
        ? admin.from("bets").select("id, side, amount, status, potential_payout")
            .eq("topic_id", topicId).eq("user_id", user.id)
        : Promise.resolve({ data: null }),
      admin.from("bets")
        .select("id, side, amount, status, locked_odds, order_id, profiles(username, full_name)")
        .eq("topic_id", topicId)
        .in("status", ["pending", "matched", "partial", "won", "lost"])
        .order("amount", { ascending: false })
        .limit(50),
      // Fonte de resolução (oracle log)
      topic.status === "resolved"
        ? admin.from("resolucoes").select("resolvido_por, oracle_usado, resultado_final, check1_fonte, check2_fonte")
            .eq("mercado_id", topicId).order("resolvido_em", { ascending: false }).limit(1).single()
        : Promise.resolve({ data: null }),
    ]);

  const stats = statsData;
  const totalSim = parseFloat(stats?.volume_sim ?? "0");
  const totalNao = parseFloat(stats?.volume_nao ?? "0");
  const totalVolume = parseFloat(stats?.total_volume ?? "0");
  const betCount = parseInt(stats?.bet_count ?? "0");
  const hasBothSides = totalSim > 0 && totalNao > 0;
  const probSim = hasBothSides ? (stats?.prob_sim ?? 0.5) : 0.5;
  const { simOdds, naoOdds } = calcOdds(totalSim, totalNao);

  const isClosed = topic.status !== "active" || new Date(topic.closes_at) < new Date();
  const isExpiredActive = topic.status === "active" && new Date(topic.closes_at) < new Date();

  if (isExpiredActive) {
    admin.from("topics").update({
      status: "resolving", oracle_retry_count: 0, oracle_next_retry_at: null,
    }).eq("id", topicId).then(() => {});
  }

  const userBalance = wallet?.balance ?? 0;
  const effectiveStatus = isExpiredActive ? "closed" : topic.status;
  const statusBadge = STATUS_BADGE[effectiveStatus] ?? STATUS_BADGE.pending;

  const probSimPct = (probSim * 100).toFixed(1);
  const probNaoPct = ((1 - probSim) * 100).toFixed(1);

  const creator = Array.isArray(topic.creator) ? topic.creator[0] : topic.creator;
  const creatorUsername = creator?.username ?? creator?.full_name ?? null;

  // Prova / fonte de resolução
  const proofUrl = resolucao?.check1_fonte || resolucao?.check2_fonte || null;
  const resolvedByLabel = resolucao?.resolvido_por ?? topic.resolved_by ?? null;

  // Apostas do usuário já finalizadas (para UserResultBanner)
  const finalizedBets = (userBets ?? []).filter((b: any) =>
    ["won", "lost", "refunded"].includes(b.status)
  );

  // Apostas ativas (para MercadoSecundario)
  const activeBets = (userBets ?? []).filter((b: any) =>
    ["pending", "matched", "partial"].includes(b.status)
  );

  return (
    <div className="py-6 max-w-5xl mx-auto">

      {/* Topo: badges + countdown + share */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={topic.category} />
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
          {/* Criador */}
          {creatorUsername && (
            <Link href={`/u/${creatorUsername}`}
              className="text-xs text-muted-foreground hover:text-white transition-colors">
              por @{creatorUsername}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <CountdownTimer closesAt={topic.closes_at} />
          <ShareButton
            title={topic.title}
            probSim={probSim}
            slug={topic.slug}
            topicId={topicId}
          />
        </div>
      </div>

      {/* Título */}
      <h1 className="text-2xl font-bold text-white leading-snug mb-4">{topic.title}</h1>

      {/* Banner resultado próprio (ganhou/perdeu) */}
      {finalizedBets.length > 0 && (
        <div className="mb-4">
          <UserResultBanner bets={finalizedBets} resolution={topic.resolution} />
        </div>
      )}

      {/* Banner de resolução em andamento */}
      {topic.status === "resolving" && (
        <div className="mb-4">
          <ResolvingBanner topicId={topicId} type="topico" />
        </div>
      )}

      {/* Banner de resultado do mercado */}
      {topic.status === "resolved" && topic.resolution && (
        <div className={`flex items-center gap-3 rounded-xl px-5 py-4 mb-6 border ${
          topic.resolution === "sim" ? "bg-sim/10 border-sim/30" : "bg-nao/10 border-nao/30"
        }`}>
          <span className={`text-3xl font-black ${topic.resolution === "sim" ? "text-sim" : "text-nao"}`}>
            {topic.resolution === "sim" ? "SIM" : "NÃO"}
          </span>
          <div className="flex-1">
            <p className={`text-sm font-bold ${topic.resolution === "sim" ? "text-sim" : "text-nao"}`}>
              Resultado: {topic.resolution === "sim" ? "SIM venceu" : "NÃO venceu"}
            </p>
            <p className="text-xs text-muted-foreground">Mercado resolvido · {resolvedByLabel === "oracle_ai" ? "Oracle AI" : resolvedByLabel === "oracle_api" ? "Oracle API" : "admin"}</p>
          </div>
          {proofUrl && (
            <a href={proofUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0">
              Ver prova →
            </a>
          )}
        </div>
      )}

      {/* Layout principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna principal (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Card principal: stats ao vivo + gráfico */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-5">

            {/* Stats ao vivo */}
            <LiveStats
              topicId={topicId}
              initialSim={totalSim}
              initialNao={totalNao}
              initialBetCount={betCount}
              isResolved={topic.status === "resolved"}
            />

            {/* Tabela de odds */}
            <div>
              <div className="grid grid-cols-3 text-[11px] text-muted-foreground pb-2 border-b border-border">
                <span>Mercado</span>
                <span className="text-center">Retorno</span>
                <span className="text-center">Chance</span>
              </div>

              {/* Linha SIM */}
              <div className="grid grid-cols-3 items-center py-3 border-b border-border/40">
                <div className="flex flex-col gap-1">
                  <div className="h-[3px] w-8 rounded-full bg-sim" />
                  <span className="text-white font-semibold text-sm">SIM</span>
                </div>
                <div className="text-center">
                  {hasBothSides
                    ? <span className="text-white font-bold text-sm">{formatOdds(simOdds)}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </div>
                <div className="flex justify-center">
                  {topic.status === "resolved" && topic.resolution === "sim" ? (
                    <span className="px-3 py-1 rounded-full bg-sim/20 text-sim font-bold text-sm border border-sim">✓ SIM</span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full font-bold text-sm border ${hasBothSides ? "border-sim text-sim" : "border-border text-muted-foreground"}`}>
                      {hasBothSides ? `${probSimPct}%` : "—"}
                    </span>
                  )}
                </div>
              </div>

              {/* Linha NÃO */}
              <div className="grid grid-cols-3 items-center py-3">
                <div className="flex flex-col gap-1">
                  <div className="h-[3px] w-8 rounded-full bg-nao" />
                  <span className="text-white font-semibold text-sm">NÃO</span>
                </div>
                <div className="text-center">
                  {hasBothSides
                    ? <span className="text-white font-bold text-sm">{formatOdds(naoOdds)}</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </div>
                <div className="flex justify-center">
                  {topic.status === "resolved" && topic.resolution === "nao" ? (
                    <span className="px-3 py-1 rounded-full bg-nao/20 text-nao font-bold text-sm border border-nao">✓ NÃO</span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full font-bold text-sm border ${hasBothSides ? "border-nao text-nao" : "border-border text-muted-foreground"}`}>
                      {hasBothSides ? `${probNaoPct}%` : "—"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Gráfico histórico */}
            <div className="border-t border-border/40 pt-4">
              <ProbabilityChart
                topicId={topicId}
                initialSnapshots={snapshots ?? []}
                initialStats={stats}
              />
            </div>

            {/* Descrição / Critério de resolução */}
            {topic.description && (
              <div className="border-t border-border/40 pt-4">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Critério de resolução</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{topic.description}</p>
              </div>
            )}
          </div>

          {/* Distribuição final (só quando resolvido) */}
          {topic.status === "resolved" && topic.resolution && (
            <ResolutionBreakdown
              totalVolume={totalVolume}
              totalSim={totalSim}
              totalNao={totalNao}
              resolution={topic.resolution as "sim" | "nao"}
              proofUrl={proofUrl}
              proofLabel={resolucao?.oracle_usado ?? "Ver fonte"}
              resolvedBy={resolvedByLabel}
            />
          )}

          {/* Apostadores */}
          {(allBets ?? []).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-white mb-3">
                Apostadores ({betCount})
              </p>
              <div className="space-y-2">
                {(allBets ?? []).map((bet: any) => {
                  const name = (bet.profiles as any)?.username ?? (bet.profiles as any)?.full_name ?? "Usuário";
                  const isSim = bet.side === "sim";
                  const isSecondaryMarket = !!bet.order_id;
                  const lockedOdds = parseFloat(bet.locked_odds ?? "0");
                  const entryPct = isSecondaryMarket && lockedOdds > 0 ? Math.round((1 / lockedOdds) * 100) : null;
                  return (
                    <div key={bet.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isSim ? "bg-sim" : "bg-nao"}`} />
                        <span className="text-white">{name}</span>
                        <span className={`font-bold ${isSim ? "text-sim" : "text-nao"}`}>{bet.side.toUpperCase()}</span>
                        {isSecondaryMarket && (
                          <span className="text-muted-foreground">@ {entryPct}%</span>
                        )}
                      </div>
                      <span className="text-muted-foreground">{formatCurrency(parseFloat(bet.amount))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Regras */}
          <RulesAccordion description={topic.description} />

          {/* Atividade social */}
          <SocialActivity topicId={topicId} currentUserId={user?.id} />

          {/* Comentários */}
          <CommentSection topicId={topicId} />
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          <BetForm
            topicId={topicId}
            minBet={topic.min_bet}
            totalSim={totalSim}
            totalNao={totalNao}
            isClosed={isClosed}
            userBalance={userBalance}
            initialSide={initialSide}
          />

          <MercadoSecundario
            topicId={topicId}
            isActive={!isClosed}
            userBets={activeBets as { id: string; side: "sim" | "nao"; amount: number; status: string }[]}
          />

          <div className="bg-card border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-white text-sm">Como funciona</p>
            <p>Todos apostam num pool. Quem ganhar divide o que o lado perdedor apostou, proporcional ao valor investido.</p>
            <p>Se ninguém apostar no lado oposto, todo mundo recebe de volta.</p>
            <p>As odds mudam conforme mais pessoas apostam.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
