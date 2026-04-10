export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("title, description, category").eq("id", id).single();
  if (!topic) return { title: "Mercado não encontrado" };
  const desc = topic.description
    ? topic.description.slice(0, 160)
    : `Aposte no resultado deste evento de ${topic.category} no Zafe.`;
  return {
    title: topic.title,
    description: desc,
    openGraph: {
      title: `${topic.title} — Zafe`,
      description: desc,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${topic.title} — Zafe`,
      description: desc,
    },
  };
}
import CategoryBadge from "@/components/topicos/CategoryBadge";
import ProbabilityChart from "@/components/topicos/ProbabilityChart";
import BetForm from "@/components/topicos/BetForm";
import CommentSection from "@/components/topicos/CommentSection";
import CountdownTimer from "@/components/topicos/CountdownTimer";
import { calcOdds, formatOdds } from "@/lib/odds";
import { formatCurrency } from "@/lib/utils";
import MercadoSecundario from "@/components/topicos/MercadoSecundario";
import SocialActivity from "@/components/topicos/SocialActivity";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ side?: string }>;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Aberto",              cls: "bg-sim/20 text-sim" },
  closed:    { label: "Fechado",             cls: "bg-yellow-500/20 text-yellow-400" },
  resolved:  { label: "Resolvido",           cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado",           cls: "bg-nao/20 text-nao" },
  pending:   { label: "Pendente",            cls: "bg-yellow-500/20 text-yellow-400" },
  resolving: { label: "Aguardando resolução",cls: "bg-yellow-500/20 text-yellow-400" },
};

export default async function TopicoDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { side: sideParam } = await searchParams;
  const initialSide = sideParam === "sim" || sideParam === "nao" ? sideParam : undefined;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const [{ data: topic }, { data: snapshots }, { data: statsData }, { data: wallet }, { data: userBets }, { data: allBets }] =
    await Promise.all([
      supabase.from("topics").select("*, creator:profiles!creator_id(*)").eq("id", id).single(),
      supabase.from("topic_snapshots").select("prob_sim, volume_sim, volume_nao, recorded_at")
        .eq("topic_id", id).order("recorded_at", { ascending: true }).limit(500),
      supabase.from("v_topic_stats").select("*").eq("topic_id", id).single(),
      user
        ? supabase.from("wallets").select("balance").eq("user_id", user.id).single()
        : Promise.resolve({ data: null }),
      user
        ? supabase.from("bets").select("id, side, amount, status")
            .eq("topic_id", id).eq("user_id", user.id)
            .in("status", ["pending", "matched", "partial"])
        : Promise.resolve({ data: null }),
      admin.from("bets")
        .select("id, side, amount, status, locked_odds, profiles(username, full_name)")
        .eq("topic_id", id)
        .in("status", ["pending", "matched", "partial", "won", "lost"])
        .order("amount", { ascending: false })
        .limit(50),
    ]);

  if (!topic) notFound();

  const stats = statsData;
  const totalSim = stats?.volume_sim ?? 0;
  const totalNao = stats?.volume_nao ?? 0;
  const totalVolume = stats?.total_volume ?? 0;
  const hasRealBets = totalVolume > 0;
  const hasBothSides = totalSim > 0 && totalNao > 0;
  const latestSnap = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const probSim = hasBothSides ? (stats?.prob_sim ?? 0.5) : (latestSnap?.prob_sim ?? 0.5);
  const { simOdds, naoOdds } = calcOdds(totalSim, totalNao);

  const isClosed = topic.status !== "active" || new Date(topic.closes_at) < new Date();
  const isExpiredActive = topic.status === "active" && new Date(topic.closes_at) < new Date();

  // Auto-fechar: se alguém abre um tópico expirado e ele ainda está active, move para resolving
  if (isExpiredActive) {
    admin.from("topics").update({
      status: "resolving",
      oracle_retry_count: 0,
      oracle_next_retry_at: null,
    }).eq("id", id).then(() => {});
  }
  const userBalance = wallet?.balance ?? 0;

  const effectiveStatus = isExpiredActive ? "closed" : topic.status;
  const statusBadge = STATUS_BADGE[effectiveStatus] ?? STATUS_BADGE.pending;

  const probSimPct = (probSim * 100).toFixed(1);
  const probNaoPct = ((1 - probSim) * 100).toFixed(1);

  return (
    <div className="py-6 max-w-5xl mx-auto">

      {/* Topo: badges + countdown */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CategoryBadge category={topic.category} />
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        </div>
        <CountdownTimer closesAt={topic.closes_at} />
      </div>

      {/* Título */}
      <h1 className="text-2xl font-bold text-white leading-snug mb-4">{topic.title}</h1>

      {/* Banner de resultado */}
      {topic.status === "resolved" && topic.resolution && (
        <div className={`flex items-center gap-3 rounded-xl px-5 py-4 mb-6 border ${
          topic.resolution === "sim"
            ? "bg-sim/10 border-sim/30"
            : "bg-nao/10 border-nao/30"
        }`}>
          <span className={`text-3xl font-black ${topic.resolution === "sim" ? "text-sim" : "text-nao"}`}>
            {topic.resolution === "sim" ? "SIM" : "NÃO"}
          </span>
          <div>
            <p className={`text-sm font-bold ${topic.resolution === "sim" ? "text-sim" : "text-nao"}`}>
              Resultado: {topic.resolution === "sim" ? "SIM venceu" : "NÃO venceu"}
            </p>
            <p className="text-xs text-muted-foreground">Mercado encerrado e resolvido</p>
          </div>
        </div>
      )}

      {/* Layout principal: conteúdo + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna principal (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Card no estilo Kalshi: tabela de lados + gráfico */}
          <div className="bg-card border border-border rounded-xl p-5">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Tabela de lados */}
              <div>
                {/* Cabeçalho */}
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
                    {hasBothSides ? (
                      <span className="text-white font-bold text-sm">{formatOdds(simOdds)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {topic.status === "resolved" && topic.resolution === "sim" ? (
                      <span className="px-3 py-1 rounded-full bg-sim/20 text-sim font-bold text-sm border border-sim">
                        ✓ SIM
                      </span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full font-bold text-sm border ${
                        hasBothSides
                          ? "border-sim text-sim"
                          : "border-border text-muted-foreground"
                      }`}>
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
                    {hasBothSides ? (
                      <span className="text-white font-bold text-sm">{formatOdds(naoOdds)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {topic.status === "resolved" && topic.resolution === "nao" ? (
                      <span className="px-3 py-1 rounded-full bg-nao/20 text-nao font-bold text-sm border border-nao">
                        ✓ NÃO
                      </span>
                    ) : (
                      <span className={`px-3 py-1 rounded-full font-bold text-sm border ${
                        hasBothSides
                          ? "border-nao text-nao"
                          : "border-border text-muted-foreground"
                      }`}>
                        {hasBothSides ? `${probNaoPct}%` : "—"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Volume */}
                <div className="pt-3 border-t border-border/40">
                  <p className="text-xs text-muted-foreground">
                    {totalVolume > 0
                      ? <>{formatCurrency(totalVolume)} <span className="ml-1">vol</span></>
                      : "Sem apostas ainda"
                    }
                  </p>
                </div>

                {/* Aviso prazo */}
                {isExpiredActive && (
                  <p className="text-xs text-yellow-400 mt-2">
                    Prazo encerrado — aguardando resolução
                  </p>
                )}
              </div>

              {/* Gráfico */}
              <ProbabilityChart
                topicId={id}
                initialSnapshots={snapshots ?? []}
                initialStats={stats}
              />
            </div>

            {/* Descrição */}
            {topic.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-5 pt-4 border-t border-border/40">
                {topic.description}
              </p>
            )}
          </div>

          {/* Quem apostou */}
          {(allBets ?? []).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-white mb-3">Apostadores</p>
              <div className="space-y-2">
                {(allBets ?? []).map((bet: any) => {
                  const name = (bet.profiles as any)?.username ?? (bet.profiles as any)?.full_name ?? "Usuário";
                  const isSim = bet.side === "sim";
                  // locked_odds = 1/price, so price = 1/locked_odds. For secondary market bets,
                  // locked_odds differs from 1.0 and encodes the trade price.
                  const lockedOdds = parseFloat(bet.locked_odds ?? "0");
                  const entryPct = lockedOdds > 0 ? Math.round((1 / lockedOdds) * 100) : null;
                  const isSecondaryMarket = entryPct !== null && entryPct !== 50;
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

          {/* Atividade social: amigos + comentários em destaque */}
          <SocialActivity topicId={id} currentUserId={user?.id} />

          {/* Comentários */}
          <CommentSection topicId={id} />
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          <BetForm
            topicId={id}
            minBet={topic.min_bet}
            totalSim={totalSim}
            totalNao={totalNao}
            isClosed={isClosed}
            userBalance={userBalance}
            initialSide={initialSide}
          />

          <MercadoSecundario
            topicId={id}
            isActive={!isClosed}
            userBets={(userBets ?? []) as { id: string; side: "sim" | "nao"; amount: number; status: string }[]}
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
