import Link from "next/link";
import { timeUntil } from "@/lib/utils";
import { calcOdds, formatOdds } from "@/lib/odds";
import { Clock } from "lucide-react";
import type { TopicWithStats } from "@/types/database";
import ProbabilityBar from "./ProbabilityBar";
import CategoryBadge from "./CategoryBadge";

interface TopicCardProps {
  topic: TopicWithStats;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Aberto",    cls: "bg-sim/15 text-sim" },
  resolved:  { label: "Resolvido", cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", cls: "bg-nao/15 text-nao" },
  closed:    { label: "Fechado",   cls: "bg-yellow-500/15 text-yellow-400" },
};

export default function TopicCard({ topic }: TopicCardProps) {
  const volumeSim = topic.stats?.volume_sim ?? 0;
  const volumeNao = topic.stats?.volume_nao ?? 0;
  const hasRealBets = (topic.stats?.total_volume ?? 0) > 0;
  const hasBothSides = volumeSim > 0 && volumeNao > 0;

  const probSim = hasBothSides ? (topic.stats?.prob_sim ?? 0.5) : 0.5;
  const { simOdds, naoOdds } = calcOdds(volumeSim, volumeNao);

  // Determinar status efetivo (active + expired = fechado)
  const isExpired = topic.status === "active" && new Date(topic.closes_at) < new Date();
  const effectiveStatus = isExpired ? "closed" : topic.status;
  const badge = STATUS_BADGE[effectiveStatus] ?? STATUS_BADGE.active;

  return (
    <Link href={`/topicos/${topic.id}`}>
      <div className="group bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={topic.category} />
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-xs shrink-0">
            <Clock size={11} />
            <span>{timeUntil(topic.closes_at)}</span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-white leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2 flex-1">
          {topic.title}
        </h3>

        <ProbabilityBar probSim={probSim} showLabels={hasBothSides} className="mb-3" />

        {/* Resultado ou volumes */}
        {topic.status === "resolved" ? (
          <div className={`text-center py-1.5 rounded-lg text-xs font-bold ${
            topic.resolution === "sim" ? "bg-sim/20 text-sim" : "bg-nao/20 text-nao"
          }`}>
            RESULTADO: {topic.resolution?.toUpperCase()}
          </div>
        ) : hasBothSides ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-sim/10 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-sim/70 font-medium">SIM</p>
              <p className="text-sm font-bold text-sim">{formatOdds(simOdds)}</p>
              <p className="text-[10px] text-sim/50 mt-0.5">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(volumeSim)}
              </p>
            </div>
            <div className="bg-nao/10 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-nao/70 font-medium">NÃO</p>
              <p className="text-sm font-bold text-nao">{formatOdds(naoOdds)}</p>
              <p className="text-[10px] text-nao/50 mt-0.5">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(volumeNao)}
              </p>
            </div>
          </div>
        ) : hasRealBets ? (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Aguardando apostas no outro lado</p>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Seja o primeiro a apostar</p>
          </div>
        )}
      </div>
    </Link>
  );
}
