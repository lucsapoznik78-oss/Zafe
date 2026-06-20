import RankBadge from "@/components/games/RankBadge";
import type { GamesTier } from "@/lib/games/types";
import { nextTierProgress } from "@/lib/games/types";

/**
 * Faixa de progressão de rank: mostra o tier atual e quantas vitórias faltam
 * para o próximo ("Você está no Bronze. Acerte mais 5 para virar Prata").
 * Derivado de events_won — a verdade do tier é server-side (games_recalc_stats).
 */
export default function RankProgress({
  tier,
  wins,
}: {
  tier: GamesTier;
  wins: number;
}) {
  const prog = nextTierProgress(wins);

  // Já é Mestre (rank máximo).
  if (!prog) {
    return (
      <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4 flex items-center gap-3">
        <RankBadge tier={tier} size="md" />
        <p className="text-sm text-white font-medium">
          Você atingiu o rank máximo. Lenda da Zafe Games.
        </p>
      </div>
    );
  }

  const span = prog.nextFloor - prog.currentFloor;
  const done = wins - prog.currentFloor;
  const pct = span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <RankBadge tier={tier} size="md" />
          <span className="text-sm text-white">
            Acerte mais{" "}
            <span className="font-bold text-violet-300">{prog.winsNeeded}</span>{" "}
            {prog.winsNeeded === 1 ? "partida" : "partidas"} para virar{" "}
            <span className="font-bold text-white">{prog.label}</span>
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {wins} / {prog.nextFloor} vitórias
        </span>
      </div>
      <div className="h-2 rounded-full bg-black/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
