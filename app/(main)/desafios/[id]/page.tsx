export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { calcOdds, formatOdds } from "@/lib/odds";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import CountdownTimer from "@/components/topicos/CountdownTimer";
import DesafioBetForm from "@/components/desafios/DesafioBetForm";
import DesafioProofForm from "@/components/desafios/DesafioProofForm";
import DesafioContestForm from "@/components/desafios/DesafioContestForm";
import LiveStats from "@/components/topicos/LiveStats";
import ProbabilityChart from "@/components/topicos/ProbabilityChart";
import MercadoSecundario from "@/components/topicos/MercadoSecundario";
import ShareButton from "@/components/topicos/ShareButton";
import UserResultBanner from "@/components/topicos/UserResultBanner";
import RulesAccordion from "@/components/topicos/RulesAccordion";
import ResolvingBanner from "@/components/topicos/ResolvingBanner";
import { pagarDesafio, reembolsarDesafio } from "@/lib/desafios-payout";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("desafios").select("title, description").eq("id", id).single();
  if (!data) return { title: "Desafio não encontrado" };
  const desc = data.description?.slice(0, 160) ?? "Desafio no Zafe";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe-rho.vercel.app";
  const ogImage = `${appUrl}/api/og?id=${id}&type=desafio`;
  return {
    title: data.title,
    description: desc,
    openGraph: {
      title: `${data.title} — Zafe`,
      description: desc,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: data.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${data.title} — Zafe`,
      description: desc,
      images: [ogImage],
    },
  };
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:             { label: "Aberto",              cls: "bg-sim/20 text-sim" },
  awaiting_proof:     { label: "Aguardando prova",    cls: "bg-yellow-500/20 text-yellow-400" },
  proof_submitted:    { label: "Prova enviada",       cls: "bg-yellow-500/20 text-yellow-400" },
  under_contestation: { label: "Em contestação",      cls: "bg-orange-500/20 text-orange-400" },
  admin_review:       { label: "Revisão admin",       cls: "bg-purple-500/20 text-purple-400" },
  resolved:           { label: "Resolvido",           cls: "bg-muted text-muted-foreground" },
  cancelled:          { label: "Cancelado",           cls: "bg-nao/20 text-nao" },
};

export default async function DesafioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: desafio },
    { data: statsData },
    { data: snapshots },
    { data: wallet },
    { data: userBets },
    { data: allBets },
  ] = await Promise.all([
    admin.from("desafios")
      .select("*, creator:profiles!creator_id(username, full_name)")
      .eq("id", id)
      .single(),
    admin.from("v_desafio_stats").select("*").eq("desafio_id", id).single(),
    admin.from("desafio_snapshots")
      .select("prob_sim, volume_sim, volume_nao, recorded_at")
      .eq("desafio_id", id)
      .order("recorded_at", { ascending: true })
      .limit(500),
    user
      ? supabase.from("wallets").select("balance").eq("user_id", user.id).single()
      : Promise.resolve({ data: null }),
    user
      ? admin.from("desafio_bets")
          .select("id, side, amount, locked_odds, status")
          .eq("desafio_id", id).eq("user_id", user.id).neq("status", "refunded")
      : Promise.resolve({ data: null }),
    admin.from("desafio_bets")
      .select("id, side, amount, status, profiles!user_id(username, full_name)")
      .eq("desafio_id", id).neq("status", "refunded")
      .order("amount", { ascending: false }).limit(50),
  ]);

  if (!desafio) notFound();

  const totalSim = parseFloat(statsData?.volume_sim ?? "0");
  const totalNao = parseFloat(statsData?.volume_nao ?? "0");
  const totalVolume = parseFloat(statsData?.total_volume ?? "0");
  const betCount = parseInt(statsData?.bet_count ?? "0");
  const hasBothSides = totalSim > 0 && totalNao > 0;
  const probSim = hasBothSides ? parseFloat(statsData?.prob_sim ?? "0.5") : 0.5;
  const { simOdds, naoOdds } = calcOdds(totalSim, totalNao);

  const isExpiredActive = desafio.status === "active" && new Date(desafio.closes_at) < new Date();
  const isClosed = desafio.status !== "active" || isExpiredActive;
  const isCreator = user?.id === desafio.creator_id;

  // Auto-trigger oracle when market expires
  if (isExpiredActive) {
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/desafios/${id}/resolver`, {
      method: "POST",
    }).catch(() => {});
  }

  // Auto-finalizar contestação se prazo expirou
  if (desafio.status === "under_contestation" && desafio.contestation_deadline_at) {
    if (new Date(desafio.contestation_deadline_at) < new Date()) {
      const resolution = desafio.resolution as "sim" | "nao" | null;
      if (resolution) {
        pagarDesafio(admin, id, resolution, "oracle").catch(console.error);
      }
    }
  }

  // Auto-reembolso se prazo de prova expirou
  if (desafio.status === "awaiting_proof" && desafio.proof_deadline_at) {
    if (new Date(desafio.proof_deadline_at) < new Date()) {
      reembolsarDesafio(admin, id, "Criador não enviou prova no prazo").catch(console.error);
    }
  }

  const effectiveStatus = isExpiredActive ? "awaiting_proof" : desafio.status;
  const badge = STATUS_BADGE[effectiveStatus] ?? STATUS_BADGE.active;
  const probSimPct = (probSim * 100).toFixed(1);
  const probNaoPct = ((1 - probSim) * 100).toFixed(1);
  const creator = Array.isArray(desafio.creator) ? desafio.creator[0] : desafio.creator;
  const creatorName = creator?.username ?? creator?.full_name ?? "Anônimo";
  const userBalance = wallet?.balance ?? 0;
  const totalUserInvested = (userBets ?? []).reduce((s: number, b: any) => s + parseFloat(b.amount), 0);

  // Apostas já finalizadas (para UserResultBanner)
  const finalizedBets = (userBets ?? []).filter((b: any) =>
    ["won", "lost", "refunded"].includes(b.status)
  );

  // Apostas ativas (para MercadoSecundario)
  const activeBets = (userBets ?? []).filter((b: any) =>
    b.status === "matched"
  );

  const chartUrl = `/api/desafios/${id}/chart`;
  const apiBase  = `/api/desafios/${id}`;

  // Snapshots for ProbabilityChart
  const chartSnapshots = (snapshots ?? []).map((s: any) => ({
    prob_sim:    parseFloat(s.prob_sim),
    volume_sim:  parseFloat(s.volume_sim),
    volume_nao:  parseFloat(s.volume_nao),
    recorded_at: s.recorded_at,
  }));

  const chartStats = statsData ? {
    prob_sim:     parseFloat(statsData.prob_sim ?? "0.5"),
    volume_sim:   totalSim,
    volume_nao:   totalNao,
    total_volume: totalVolume,
  } : null;

  return (
    <div className="py-6 max-w-5xl mx-auto">

      {/* Topo: badges + countdown + share */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={desafio.category} />
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-xs text-muted-foreground">por @{creatorName}</span>
        </div>
        <div className="flex items-center gap-3">
          <CountdownTimer closesAt={desafio.closes_at} />
          <ShareButton
            title={desafio.title}
            probSim={probSim}
            pagePath={`/desafios/${id}`}
          />
        </div>
      </div>

      {/* Título */}
      <h1 className="text-2xl font-bold text-white leading-snug mb-4">{desafio.title}</h1>

      {/* Banner resultado próprio */}
      {finalizedBets.length > 0 && (
        <div className="mb-4">
          <UserResultBanner bets={finalizedBets} resolution={desafio.resolution} />
        </div>
      )}

      {/* Banner resultado do desafio */}
      {desafio.status === "resolved" && desafio.resolution && (
        <div className={`flex items-center gap-3 rounded-xl px-5 py-4 mb-6 border ${
          desafio.resolution === "sim" ? "bg-sim/10 border-sim/30" : "bg-nao/10 border-nao/30"
        }`}>
          <span className={`text-3xl font-black ${desafio.resolution === "sim" ? "text-sim" : "text-nao"}`}>
            {desafio.resolution === "sim" ? "SIM" : "NÃO"}
          </span>
          <div>
            <p className={`text-sm font-bold ${desafio.resolution === "sim" ? "text-sim" : "text-nao"}`}>
              Resultado: {desafio.resolution === "sim" ? "SIM venceu" : "NÃO venceu"}
            </p>
            <p className="text-xs text-muted-foreground">
              Resolvido por {desafio.resolved_by ?? "sistema"}
            </p>
          </div>
        </div>
      )}

      {/* Formulário de prova — coluna cheia, visível ao criador assim que o desafio fecha */}
      {isCreator && (desafio.status === "awaiting_proof" || isExpiredActive) && (
        <div className="mb-2">
          {isExpiredActive && desafio.status !== "awaiting_proof" ? (
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-yellow-300">Desafio encerrado — aguardando análise automática</p>
              <p className="text-xs text-yellow-400/70 leading-relaxed">
                O oracle de IA está tentando resolver o resultado. Se não conseguir, você será notificado para enviar uma prova.
                Você pode enviar sua prova agora para agilizar o processo.
              </p>
              <DesafioProofForm desafioId={id} proofDeadlineAt={desafio.proof_deadline_at} />
            </div>
          ) : (
            <DesafioProofForm desafioId={id} proofDeadlineAt={desafio.proof_deadline_at} />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">

          {/* LiveStats */}
          <div className="bg-card border border-border rounded-xl p-4">
            <LiveStats
              chartUrl={chartUrl}
              initialSim={totalSim}
              initialNao={totalNao}
              initialBetCount={betCount}
              isResolved={desafio.status === "resolved"}
            />
          </div>

          {/* Odds + probabilidade */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="grid grid-cols-3 text-[11px] text-muted-foreground pb-2 border-b border-border mb-3">
              <span>Mercado</span>
              <span className="text-center">Retorno</span>
              <span className="text-center">Chance</span>
            </div>

            {/* SIM */}
            <div className="grid grid-cols-3 items-center py-3 border-b border-border/40">
              <div className="flex flex-col gap-1">
                <div className="h-[3px] w-8 rounded-full bg-sim" />
                <span className="text-white font-semibold text-sm">SIM</span>
              </div>
              <div className="text-center">
                {hasBothSides
                  ? <span className="text-white font-bold text-sm">{formatOdds(simOdds)}</span>
                  : <span className="text-muted-foreground text-xs">—</span>
                }
              </div>
              <div className="flex justify-center">
                {desafio.status === "resolved" && desafio.resolution === "sim" ? (
                  <span className="px-3 py-1 rounded-full bg-sim/20 text-sim font-bold text-sm border border-sim">✓ SIM</span>
                ) : (
                  <span className={`px-3 py-1 rounded-full font-bold text-sm border ${
                    hasBothSides ? "border-sim text-sim" : "border-border text-muted-foreground"
                  }`}>
                    {hasBothSides ? `${probSimPct}%` : "—"}
                  </span>
                )}
              </div>
            </div>

            {/* NÃO */}
            <div className="grid grid-cols-3 items-center py-3">
              <div className="flex flex-col gap-1">
                <div className="h-[3px] w-8 rounded-full bg-nao" />
                <span className="text-white font-semibold text-sm">NÃO</span>
              </div>
              <div className="text-center">
                {hasBothSides
                  ? <span className="text-white font-bold text-sm">{formatOdds(naoOdds)}</span>
                  : <span className="text-muted-foreground text-xs">—</span>
                }
              </div>
              <div className="flex justify-center">
                {desafio.status === "resolved" && desafio.resolution === "nao" ? (
                  <span className="px-3 py-1 rounded-full bg-nao/20 text-nao font-bold text-sm border border-nao">✓ NÃO</span>
                ) : (
                  <span className={`px-3 py-1 rounded-full font-bold text-sm border ${
                    hasBothSides ? "border-nao text-nao" : "border-border text-muted-foreground"
                  }`}>
                    {hasBothSides ? `${probNaoPct}%` : "—"}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                {totalVolume > 0
                  ? <>{formatCurrency(totalVolume)} <span className="ml-1">vol</span></>
                  : "Sem apostas ainda"
                }
              </p>
            </div>

            {desafio.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-border/40">
                {desafio.description}
              </p>
            )}
          </div>

          {/* Gráfico de probabilidade */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-white mb-3">Evolução das probabilidades</p>
            <ProbabilityChart
              chartUrl={chartUrl}
              initialSnapshots={chartSnapshots}
              initialStats={chartStats}
            />
          </div>

          {/* Distribuição */}
          <div className="bg-card border border-border rounded-xl p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-white text-sm">Distribuição</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/30 rounded-lg py-2">
                <p className="text-white font-bold text-base">6%</p>
                <p className="text-[10px]">Criador</p>
              </div>
              <div className="bg-muted/30 rounded-lg py-2">
                <p className="text-white font-bold text-base">6%</p>
                <p className="text-[10px]">Zafe</p>
              </div>
              <div className="bg-sim/10 rounded-lg py-2">
                <p className="text-sim font-bold text-base">88%</p>
                <p className="text-[10px]">Vencedores</p>
              </div>
            </div>
            <p>Pool distribuído proporcionalmente entre os apostadores do lado vencedor.</p>
          </div>

          {/* Apostadores */}
          {(allBets ?? []).length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-white mb-3">Apostadores</p>
              <div className="space-y-2">
                {(allBets ?? []).map((bet: any) => {
                  const p = Array.isArray(bet.profiles) ? bet.profiles[0] : bet.profiles;
                  const name = p?.username ?? p?.full_name ?? "Usuário";
                  const isSim = bet.side === "sim";
                  return (
                    <div key={bet.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isSim ? "bg-sim" : "bg-nao"}`} />
                        <span className="text-white">@{name}</span>
                        <span className={`font-bold ${isSim ? "text-sim" : "text-nao"}`}>{bet.side.toUpperCase()}</span>
                      </div>
                      <span className="text-muted-foreground">{formatCurrency(parseFloat(bet.amount))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mercado Secundário */}
          {/* Banner de resolução em andamento */}
          {(desafio.status === "resolving" || desafio.status === "proof_submitted" || desafio.status === "admin_review") && (
            <ResolvingBanner topicId={id} type="desafio" />
          )}

          <MercadoSecundario
            apiBase={apiBase}
            isActive={!isClosed}
            userBets={activeBets as { id: string; side: "sim" | "nao"; amount: number; status: string }[]}
            commissionPct={6}
          />

          {/* Regras */}
          <RulesAccordion description={desafio.description} type="desafio" />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Saldo investido */}
          {totalUserInvested > 0 && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">Você tem aqui</p>
              <p className="text-primary font-bold text-lg">{formatCurrency(totalUserInvested)}</p>
            </div>
          )}

          {/* Formulário de aposta */}
          <DesafioBetForm
            desafioId={id}
            minBet={parseFloat(desafio.min_bet ?? "1")}
            totalSim={totalSim}
            totalNao={totalNao}
            isClosed={isClosed}
            userBalance={parseFloat(String(userBalance))}
            isCreator={isCreator}
          />

          {/* Formulário de prova (criador, aguardando prova) */}
          {isCreator && desafio.status === "awaiting_proof" && (
            <DesafioProofForm
              desafioId={id}
              proofDeadlineAt={desafio.proof_deadline_at}
            />
          )}

          {/* Formulário de contestação (apostadores, em contestação) */}
          {!isCreator && desafio.status === "under_contestation" && desafio.contestation_deadline_at && (
            <DesafioContestForm
              desafioId={id}
              contestationDeadlineAt={desafio.contestation_deadline_at}
            />
          )}

          {/* Prova enviada — visualização pública */}
          {desafio.proof_url && ["proof_submitted", "under_contestation", "admin_review", "resolved"].includes(desafio.status) && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-white">Prova enviada</p>
              <p className="text-xs text-muted-foreground capitalize">{desafio.proof_type?.replace("_", " ")}</p>
              <a
                href={desafio.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline break-all"
              >
                {desafio.proof_url}
              </a>
              {desafio.proof_notes && (
                <p className="text-xs text-muted-foreground italic">{desafio.proof_notes}</p>
              )}
            </div>
          )}

          {/* Oracle notes (visível para todos quando há contestação/resolução) */}
          {desafio.oracle_notes && ["under_contestation", "admin_review", "resolved"].includes(desafio.status) && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-white">Avaliação do oráculo</p>
              <p className="text-xs text-muted-foreground">{desafio.oracle_notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
