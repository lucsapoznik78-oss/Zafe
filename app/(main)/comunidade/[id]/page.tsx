export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import ProbabilityBar from "@/components/topicos/ProbabilityBar";
import CommunityBetForm from "@/components/comunidade/CommunityBetForm";
import ResolveForm from "@/components/comunidade/ResolveForm";
import ContestButton from "@/components/comunidade/ContestButton";
import DeleteEventButton from "@/components/comunidade/DeleteEventButton";
import { formatCurrency, timeUntil } from "@/lib/utils";
import { Clock, Star, User, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: event } = await admin.from("community_events").select("title, description").eq("id", id).single();
  if (!event) return { title: "Evento não encontrado — Zafe" };
  return {
    title: `${event.title} — Comunidade Zafe`,
    description: event.description?.slice(0, 160),
    alternates: { canonical: `/comunidade/${id}` },
  };
}

export default async function CommunityDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: event } = await admin
    .from("community_events")
    .select("*, creator:profiles!creator_id(id, username, full_name)")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const [{ data: stats }, { data: wallet }, { data: userBets }, { data: allBets }, { data: rep }, { data: contestations }] = await Promise.all([
    admin.from("v_community_event_stats").select("*").eq("event_id", id).single(),
    user ? admin.from("wallets").select("balance").eq("user_id", user.id).single() : { data: null },
    user ? admin.from("community_bets").select("*").eq("event_id", id).eq("user_id", user.id) : { data: [] },
    admin.from("community_bets").select("*, user:profiles!user_id(username, full_name)").eq("event_id", id).order("created_at", { ascending: false }),
    admin.from("creator_reputation").select("*").eq("user_id", event.creator_id).single(),
    admin.from("community_contestations").select("*, user:profiles!user_id(username)").eq("event_id", id).order("created_at", { ascending: false }),
  ]);

  const volumeSim = stats?.volume_sim ?? 0;
  const volumeNao = stats?.volume_nao ?? 0;
  const totalVolume = stats?.total_volume ?? 0;
  const hasBothSides = volumeSim > 0 && volumeNao > 0;
  const probSim = hasBothSides ? (stats?.prob_sim ?? 0.5) : 0.5;
  const isCreator = user?.id === event.creator_id;
  const isClosed = event.status !== "active" || new Date(event.closes_at) < new Date();
  const isResolved = event.status === "community_resolved";
  const isAwaitingResolution = event.status === "awaiting_resolution";
  const creatorScore = rep?.score ?? 50;

  // Contest window: 48h after resolution
  const canContest = isResolved && user && !isCreator &&
    (userBets ?? []).length > 0 &&
    new Date().getTime() - new Date(event.resolved_at).getTime() < 48 * 3600000;

  const fmtZ = (v: number) => "Z$ " + new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    active:              { label: "Aberto", cls: "bg-sim/20 text-sim" },
    awaiting_resolution: { label: "Aguardando resolução do criador", cls: "bg-yellow-500/20 text-yellow-400" },
    community_resolved:  { label: "Resolvido", cls: "bg-muted text-muted-foreground" },
    contested:           { label: "Contestado", cls: "bg-orange-500/20 text-orange-300" },
    under_review:        { label: "Em revisão pela Zafe", cls: "bg-purple-500/20 text-purple-300" },
    auto_cancelled:      { label: "Cancelado (sem resolução)", cls: "bg-nao/20 text-nao" },
    mod_cancelled:       { label: "Removido pela moderação", cls: "bg-nao/20 text-nao" },
    creator_cancelled:   { label: "Apagado pelo criador", cls: "bg-nao/20 text-nao" },
    reversed:            { label: "Resultado revertido", cls: "bg-orange-500/20 text-orange-300" },
  };

  const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.active;

  return (
    <div className="py-6 max-w-4xl mx-auto">
      <Link href="/comunidade" className="text-xs text-muted-foreground hover:text-white mb-4 block">
        &larr; Voltar para Comunidade
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 uppercase">
                Comunidade
              </span>
              <CategoryBadge category={event.category} />
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>
                {badge.label}
              </span>
            </div>

            <h1 className="text-xl font-bold text-white">{event.title}</h1>
            <p className="text-sm text-muted-foreground">{event.description}</p>

            {/* Creator info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Link href={`/u/${event.creator?.username}`} className="flex items-center gap-1.5 hover:text-white">
                <User size={12} />
                @{event.creator?.username}
              </Link>
              <span className="flex items-center gap-1">
                <Star size={12} className={creatorScore >= 90 ? "text-yellow-400" : ""} />
                Nota {creatorScore}
              </span>
              {event.status === "active" && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {timeUntil(event.closes_at)}
                </span>
              )}
            </div>
          </div>

          {/* Probability */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <ProbabilityBar probSim={probSim} showLabels={hasBothSides} size="lg" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Volume SIM</p>
                <p className="text-sm font-bold text-sim">{fmtZ(volumeSim)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Total</p>
                <p className="text-sm font-bold text-white">{fmtZ(totalVolume)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Volume NÃO</p>
                <p className="text-sm font-bold text-nao">{fmtZ(volumeNao)}</p>
              </div>
            </div>
          </div>

          {/* Resolution result */}
          {isResolved && event.resolution && (
            <div className={`rounded-xl p-4 text-center ${
              event.resolution === "sim" ? "bg-sim/10 border border-sim/30" : "bg-nao/10 border border-nao/30"
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Resultado</p>
              <p className={`text-2xl font-bold ${event.resolution === "sim" ? "text-sim" : "text-nao"}`}>
                {event.resolution.toUpperCase()}
              </p>
              {event.creator_commission > 0 && isCreator && (
                <p className="text-xs text-muted-foreground mt-2">
                  Comissão de criador: {formatCurrency(event.creator_commission)}
                </p>
              )}
            </div>
          )}

          {/* Contestation section */}
          {canContest && <ContestButton eventId={id} canContest={true} />}

          {(contestations ?? []).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-orange-300 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Contestações ({contestations?.length ?? 0})
              </h3>
              {(contestations ?? []).map((c: any) => (
                <div key={c.id} className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-xs text-white">@{c.user?.username}: {c.reason}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(c.created_at).toLocaleString("pt-BR")} — {c.status}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* User bets */}
          {(userBets ?? []).length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Seus palpites</h3>
              {(userBets ?? []).map((b: any) => (
                <div key={b.id} className={`rounded-lg p-3 border text-sm ${
                  b.status === "won" ? "bg-sim/10 border-sim/30 text-sim" :
                  b.status === "lost" ? "bg-nao/10 border-nao/30 text-nao" :
                  b.status === "refunded" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
                  "bg-card border-border text-white"
                }`}>
                  <span className="font-bold">{b.side.toUpperCase()}</span>
                  {" "}{formatCurrency(b.amount)}
                  {b.status === "won" && ` → ${formatCurrency(b.potential_payout)}`}
                  <span className="text-xs ml-2 opacity-70">({b.status})</span>
                </div>
              ))}
            </div>
          )}

          {/* All bets */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Atividade ({(allBets ?? []).length})</h3>
            {(allBets ?? []).slice(0, 20).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">@{b.user?.username}</span>
                  {" "}
                  <span className={b.side === "sim" ? "text-sim font-bold" : "text-nao font-bold"}>
                    {b.side.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-white font-medium">{formatCurrency(b.amount)}</span>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2.5">
            <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-yellow-200/80">
              Este evento foi criado e será resolvido por @{event.creator?.username}. A Zafe não garante a veracidade do resultado.
              Palpites na Comunidade contam para seu ranking geral, mas não para o concurso mensal.
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {isAwaitingResolution && isCreator && (
            <ResolveForm eventId={id} />
          )}

          {event.status === "active" && !isClosed && (
            <CommunityBetForm
              eventId={id}
              totalSim={volumeSim}
              totalNao={volumeNao}
              isClosed={isClosed}
              userBalance={wallet?.balance ?? 0}
            />
          )}

          {isClosed && !isResolved && !isAwaitingResolution && (
            <div className="bg-card border border-border rounded-xl p-4 text-center text-muted-foreground text-sm">
              Este evento não aceita mais palpites
            </div>
          )}

          {/* Apagar evento — só o criador, e só enquanto não confirmado (sem palpites nos dois lados) */}
          {isCreator && event.status === "active" && !hasBothSides && (
            <DeleteEventButton eventId={id} hasBets={totalVolume > 0} />
          )}
        </div>
      </div>
    </div>
  );
}
