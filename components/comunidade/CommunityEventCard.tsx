import Link from "next/link";
import { timeUntil } from "@/lib/utils";
import { Clock, Star } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import ProbabilityBar from "@/components/topicos/ProbabilityBar";

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  resolution: string | null;
  closes_at: string;
  total_volume: number;
  participant_count: number;
  creator?: { username: string; full_name: string };
  creator_reputation?: { score: number };
  stats?: { volume_sim: number; volume_nao: number; total_volume: number; prob_sim: number; bet_count: number };
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:                { label: "Aberto",     cls: "bg-sim/15 text-sim" },
  awaiting_resolution:   { label: "Aguardando", cls: "bg-yellow-500/15 text-yellow-400" },
  community_resolved:    { label: "Resolvido",  cls: "bg-muted text-muted-foreground" },
  contested:             { label: "Contestado", cls: "bg-orange-500/15 text-orange-300" },
  under_review:          { label: "Em revisão", cls: "bg-purple-500/15 text-purple-300" },
  auto_cancelled:        { label: "Cancelado",  cls: "bg-nao/15 text-nao" },
  mod_cancelled:         { label: "Removido",   cls: "bg-nao/15 text-nao" },
};

export default function CommunityEventCard({ event }: { event: CommunityEvent }) {
  const volumeSim = event.stats?.volume_sim ?? 0;
  const volumeNao = event.stats?.volume_nao ?? 0;
  const totalVolume = event.stats?.total_volume ?? 0;
  const hasBothSides = volumeSim > 0 && volumeNao > 0;
  const probSim = hasBothSides ? (event.stats?.prob_sim ?? 0.5) : 0.5;

  const badge = STATUS_BADGE[event.status] ?? STATUS_BADGE.active;
  const creatorScore = (event as any).creator_reputation?.score ?? 50;

  const fmtZ = (v: number) => "Z$ " + new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

  return (
    <Link href={`/comunidade/${event.id}`}>
      <div className="group bg-card border border-dashed border-border rounded-xl p-4 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300">
              COMUNIDADE
            </span>
            <CategoryBadge category={event.category as any} />
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          {event.status === "active" && (
            <div className="flex items-center gap-1 text-muted-foreground text-xs shrink-0">
              <Clock size={11} />
              <span>{timeUntil(event.closes_at)}</span>
            </div>
          )}
        </div>

        <h3 className="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2 flex-1">
          {event.title}
        </h3>

        {/* Creator info */}
        <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
          <span>por @{event.creator?.username ?? "?"}</span>
          <span className="flex items-center gap-0.5">
            <Star size={10} className={creatorScore >= 90 ? "text-yellow-400" : "text-muted-foreground"} />
            {creatorScore}
          </span>
        </div>

        {!hasBothSides ? (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">
              {totalVolume > 0 ? "Aguardando palpites no outro lado" : "Seja o primeiro a palpitar"}
            </p>
          </div>
        ) : event.status === "community_resolved" && event.resolution ? (
          <div className={`text-center py-1.5 rounded-lg text-xs font-bold ${
            event.resolution === "sim" ? "bg-sim/10 text-sim" : "bg-nao/10 text-nao"
          }`}>
            {event.resolution.toUpperCase()}
          </div>
        ) : (
          <>
            <ProbabilityBar probSim={probSim} showLabels={hasBothSides} className="mb-3" />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{fmtZ(totalVolume)} no pool</span>
              <span>{event.stats?.bet_count ?? 0} palpites</span>
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
