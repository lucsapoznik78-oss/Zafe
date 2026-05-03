export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import CountdownTimer from "@/components/topicos/CountdownTimer";
import ProbabilityChart from "@/components/topicos/ProbabilityChart";
import LiveStats from "@/components/topicos/LiveStats";
import ResolvingBanner from "@/components/topicos/ResolvingBanner";
import ConcursoBetForm from "@/components/concurso/ConcursoBetForm";
import ParticipantsList from "@/components/topicos/ParticipantsList";
import { calcOdds } from "@/lib/odds";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Aberto",               cls: "bg-yellow-400/20 text-yellow-400" },
  resolved:  { label: "Resolvido",            cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado",            cls: "bg-red-500/20 text-red-400" },
  pending:   { label: "Em moderação",         cls: "bg-yellow-400/20 text-yellow-400" },
  resolving: { label: "Aguardando resolução", cls: "bg-yellow-500/20 text-yellow-400" },
};

export default async function ConcursoTopicPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const isUUID = /^[0-9a-f-]{36}$/.test(id);
  const topicQuery = admin.from("topics").select("*, creator:profiles!creator_id(id, username, full_name)");
  const { data: topic } = isUUID
    ? await topicQuery.eq("id", id).single()
    : await topicQuery.eq("slug", id).single();

  if (!topic) notFound();

  const topicId = topic.id;

  // Get active concurso and user enrollment
  const { data: concurso } = await admin
    .from("concursos")
    .select("id, titulo, saldo_inicial")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  let enrolled = false;
  let zcBalance = 0;
  let userConcursoBets: any[] = [];

  if (user && concurso) {
    const [{ data: inscricao }, { data: wallet }, { data: myBets }] = await Promise.all([
      admin.from("inscricoes_concurso")
        .select("id").eq("user_id", user.id).eq("concurso_id", concurso.id).single(),
      admin.from("concurso_wallets")
        .select("balance").eq("user_id", user.id).eq("concurso_id", concurso.id).single(),
      admin.from("concurso_bets")
        .select("id, side, amount, status, potential_payout, created_at")
        .eq("user_id", user.id).eq("topic_id", topicId)
        .eq("concurso_id", concurso.id)
        .order("created_at", { ascending: false }),
    ]);
    enrolled = !!inscricao;
    zcBalance = wallet?.balance ?? 0;
    userConcursoBets = myBets ?? [];
  }

  // Topic stats
  const [{ data: statsData }, { data: snapshots }, { data: concursoBetsPool }, { data: allConcursoBets }] = await Promise.all([
    admin.from("v_topic_stats").select("*").eq("topic_id", topicId).single(),
    admin.from("topic_snapshots")
      .select("prob_sim, volume_sim, volume_nao, recorded_at")
      .eq("topic_id", topicId).order("recorded_at", { ascending: true }).limit(500),
    admin.from("concurso_bets")
      .select("side, amount")
      .eq("topic_id", topicId)
      .eq("status", "matched")
      .eq("concurso_id", concurso?.id ?? ""),
    admin.from("concurso_bets")
      .select("id, side, amount, status, potential_payout, created_at, profiles(username, full_name)")
      .eq("topic_id", topicId)
      .in("status", ["matched", "won", "lost", "refunded"])
      .order("amount", { ascending: false })
      .limit(100),
  ]);

  const stats = statsData;
  const totalSim = parseFloat(stats?.volume_sim ?? "0");
  const totalNao = parseFloat(stats?.volume_nao ?? "0");
  const totalVolume = parseFloat(stats?.total_volume ?? "0");
  const betCount = parseInt(stats?.bet_count ?? "0");
  const hasBothSides = totalSim > 0 && totalNao > 0;
  const probSim = hasBothSides ? (stats?.prob_sim ?? 0.5) : 0.5;
  const { simOdds, naoOdds } = calcOdds(totalSim, totalNao);

  // Concurso pool for this topic
  const poolSim = (concursoBetsPool ?? []).filter((b: any) => b.side === "sim").reduce((s: number, b: any) => s + Number(b.amount), 0);
  const poolNao = (concursoBetsPool ?? []).filter((b: any) => b.side === "nao").reduce((s: number, b: any) => s + Number(b.amount), 0);

  // Participantes — total ZC$ por lado
  const concursoSimTotal = (allConcursoBets ?? []).filter((b: any) => b.side === "sim").reduce((s: number, b: any) => s + Number(b.amount), 0);
  const concursoNaoTotal = (allConcursoBets ?? []).filter((b: any) => b.side === "nao").reduce((s: number, b: any) => s + Number(b.amount), 0);

  const isClosed = topic.status !== "active" || new Date(topic.closes_at) < new Date();
  const statusBadge = STATUS_BADGE[topic.status] ?? STATUS_BADGE.pending;
  const probSimPct = (probSim * 100).toFixed(1);
  const probNaoPct = ((1 - probSim) * 100).toFixed(1);

  const creator = Array.isArray(topic.creator) ? topic.creator[0] : topic.creator;
  const creatorUsername = creator?.username ?? null;

  return (
    <div className="py-6 max-w-5xl mx-auto">
      {/* Breadcrumb concurso */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/concurso" className="flex items-center gap-1.5 text-yellow-400 hover:text-yellow-300 text-sm transition-colors">
          <ArrowLeft size={14} />
          <Trophy size={14} />
          Concurso
        </Link>
        <span className="text-muted-foreground text-sm">/</span>
        <span className="text-muted-foreground text-sm truncate">{topic.title.slice(0, 50)}</span>
      </div>

      {/* Topo: badges + countdown */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryBadge category={topic.category} />
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
          {creatorUsername && (
            <Link href={`/u/${creatorUsername}`} className="text-xs text-muted-foreground hover:text-white transition-colors">
              por @{creatorUsername}
            </Link>
          )}
        </div>
        <CountdownTimer closesAt={topic.closes_at} />
      </div>

      <h1 className="text-2xl font-bold text-white leading-snug mb-2">{topic.title}</h1>
      {topic.description && (
        <p className="text-muted-foreground text-sm mb-4">{topic.description}</p>
      )}

      {/* Resolving banner */}
      {topic.status === "resolving" && (
        <div className="mb-4">
          <ResolvingBanner topicId={topicId} />
        </div>
      )}

      {/* Resultado se resolvido */}
      {topic.status === "resolved" && topic.resolution && (
        <div className={`mb-4 rounded-xl px-4 py-3 font-bold text-center text-lg ${
          topic.resolution === "sim" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        }`}>
          Resultado: {topic.resolution.toUpperCase()}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Barra de probabilidade — baseada no pool GERAL da Liga */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Probabilidade (pool geral da Liga)</p>
            <div className="flex rounded-lg overflow-hidden h-8 mb-2">
              <div className="bg-sim flex items-center justify-center text-black text-xs font-bold transition-all" style={{ width: `${probSimPct}%` }}>
                {Number(probSimPct) > 12 ? `${probSimPct}%` : ""}
              </div>
              <div className="bg-nao flex items-center justify-center text-white text-xs font-bold transition-all" style={{ width: `${probNaoPct}%` }}>
                {Number(probNaoPct) > 12 ? `${probNaoPct}%` : ""}
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>SIM <span className="text-sim font-semibold">{probSimPct}%</span></span>
              <span>NÃO <span className="text-nao font-semibold">{probNaoPct}%</span></span>
            </div>
          </div>

          {/* LiveStats */}
          <LiveStats
            topicId={topicId}
            initialSim={totalSim}
            initialNao={totalNao}
            initialBetCount={betCount}
            isResolved={topic.status === "resolved"}
          />

          {/* Gráfico */}
          {snapshots && snapshots.length > 0 && (
            <ProbabilityChart topicId={topicId} initialSnapshots={snapshots} initialStats={stats} />
          )}

          {/* Participantes do concurso neste evento */}
          <div className="space-y-2">
            <div className="flex justify-end">
              <Link
                href={`/concurso/${topic.slug ?? topicId}/participantes`}
                className="text-xs text-muted-foreground hover:text-white transition-colors"
              >
                Ver histórico completo de participantes →
              </Link>
            </div>
            <ParticipantsList
              bets={allConcursoBets ?? []}
              totalSim={concursoSimTotal}
              totalNao={concursoNaoTotal}
            />
          </div>

          {/* Meus palpites no concurso */}
          {userConcursoBets.length > 0 && (
            <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4">
              <p className="text-sm font-semibold text-yellow-400 mb-3">Meus palpites no concurso</p>
              <div className="space-y-2">
                {userConcursoBets.map((bet: any) => {
                  const statusMap: Record<string, { label: string; cls: string }> = {
                    matched:  { label: "Em jogo",   cls: "text-yellow-400" },
                    won:      { label: "Ganhou",    cls: "text-green-400" },
                    lost:     { label: "Perdeu",    cls: "text-red-400" },
                    refunded: { label: "Reembolso", cls: "text-muted-foreground" },
                  };
                  const s = statusMap[bet.status] ?? { label: bet.status, cls: "text-muted-foreground" };
                  return (
                    <div key={bet.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${bet.side === "sim" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {bet.side.toUpperCase()}
                        </span>
                        <span className="text-white">ZC$ {Number(bet.amount).toFixed(0)}</span>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(bet.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold ${s.cls}`}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {concurso ? (
            enrolled ? (
              <ConcursoBetForm
                topicId={topicId}
                poolSim={poolSim}
                poolNao={poolNao}
                isClosed={isClosed}
                zcBalance={zcBalance}
              />
            ) : (
              <div className="bg-yellow-400/5 border border-yellow-400/30 rounded-xl p-4 text-center space-y-3">
                <Trophy size={28} className="mx-auto text-yellow-400/60" />
                <p className="text-yellow-400 font-semibold text-sm">Participe do Concurso</p>
                <p className="text-xs text-yellow-300/60">
                  Inscreva-se grátis e receba ZC$ {concurso.saldo_inicial} para competir.
                </p>
                <Link
                  href="/concurso"
                  className="block w-full py-2.5 rounded-lg bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 transition-colors"
                >
                  Inscrever-se
                </Link>
              </div>
            )
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 text-center text-sm text-muted-foreground">
              Nenhum concurso ativo no momento.
            </div>
          )}

          {/* Link para ver na Liga (com palpite normal) */}
          <Link
            href={`/${topic.category === "economia" ? "economico" : "liga"}/${topic.slug ?? topicId}`}
            className="block text-center text-xs text-muted-foreground hover:text-white transition-colors py-2"
          >
            Ver na Liga (palpitar com Z$) →
          </Link>
        </div>
      </div>
    </div>
  );
}
