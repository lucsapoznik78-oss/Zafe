import Link from "next/link";
import { timeUntil } from "@/lib/utils";

function formatCloseDate(closesAt: string): string {
  const d = new Date(closesAt);
  const now = new Date();
  if (d < now) return "Encerrado";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} às ${h}:${m}`;
}
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
  const isMulti = topic.market_type === "multi";
  const volumeSim = topic.stats?.volume_sim ?? 0;
  const volumeNao = topic.stats?.volume_nao ?? 0;
  const totalVolume = topic.stats?.total_volume ?? 0;
  const hasRealBets = totalVolume > 0;
  const hasBothSides = volumeSim > 0 && volumeNao > 0;

  const probSim = hasBothSides ? (topic.stats?.prob_sim ?? 0.5) : 0.5;
  const { simOdds, naoOdds } = calcOdds(volumeSim, volumeNao);

  const isExpired = topic.status === "active" && new Date(topic.closes_at) < new Date();
  const effectiveStatus = isExpired ? "closed" : topic.status;
  const badge = STATUS_BADGE[effectiveStatus] ?? STATUS_BADGE.active;

  const slug = (topic as any).slug;
  const base = topic.category === "economia" ? "/economico" : "/liga";
  const href = `${base}/${slug ?? topic.id}`;

  const fmtZ = (v: number) => "Z$ " + new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

  return (
    <Link href={href}>
      <div className="group bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-card/80 transition-all duration-200 cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={topic.category} />
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.cls}`}>
              {badge.label}
            </span>
            {isMulti && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary">
                MULTI
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-xs shrink-0">
            <Clock size={11} />
            <span>{formatCloseDate(topic.closes_at)}</span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-white leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2 flex-1">
          {topic.title}
        </h3>

        {/* Barra de probabilidade só para binários */}
        {!isMulti && <ProbabilityBar probSim={probSim} showLabels={hasBothSides} className="mb-3" />}

        {/* Footer do card */}
        {topic.status === "resolved" ? (
          topic.winning_outcome_id || topic.resolution ? (
            <div className="text-center py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary">
              RESOLVIDO
            </div>
          ) : hasRealBets ? (
            <div className="text-center py-1.5 rounded-lg text-xs font-bold bg-yellow-500/10 text-yellow-400">
              REEMBOLSADO
            </div>
          ) : (
            <div className="text-center py-1.5 rounded-lg text-xs font-bold bg-muted/20 text-muted-foreground">
              SEM PALPITES
            </div>
          )
        ) : isMulti ? (
          <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {hasRealBets ? `${fmtZ(totalVolume)} no pool` : "Seja o primeiro a palpitar"}
            </span>
            <span className="text-[10px] text-primary font-semibold">
              {topic.stats?.bet_count ? `${topic.stats.bet_count} palpites` : "Múltiplos resultados"}
            </span>
          </div>
        ) : hasBothSides ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-sim/10 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-sim/70 font-medium">SIM</p>
              <p className="text-sm font-bold text-sim">{formatOdds(simOdds)}</p>
              <p className="text-[10px] text-sim/50 mt-0.5">{fmtZ(volumeSim)}</p>
            </div>
            <div className="bg-nao/10 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-nao/70 font-medium">NÃO</p>
              <p className="text-sm font-bold text-nao">{formatOdds(naoOdds)}</p>
              <p className="text-[10px] text-nao/50 mt-0.5">{fmtZ(volumeNao)}</p>
            </div>
          </div>
        ) : hasRealBets ? (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Aguardando palpites no outro lado</p>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Seja o primeiro a palpitar</p>
          </div>
        )}
      </div>
    </Link>
  );
}
