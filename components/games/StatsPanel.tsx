import { TrendingUp, Flame, Target, Trophy } from "lucide-react";
import type { GamesUserStats } from "@/lib/games/types";

/**
 * Painel de estatísticas da Zafe Games — público para qualquer participante
 * logado (aproveitamento, vitórias, sequência). Sem gate de Premium.
 */
export default function StatsPanel({ stats }: { stats: GamesUserStats | null }) {
  const played = stats?.events_played ?? 0;
  const won = stats?.events_won ?? 0;
  const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

  const metrics = [
    { icon: Target, label: "Aproveitamento", value: `${winRate}%` },
    { icon: Trophy, label: "Vitórias", value: String(won) },
    { icon: Flame, label: "Sequência atual", value: String(stats?.current_streak ?? 0) },
    { icon: TrendingUp, label: "Melhor sequência", value: String(stats?.best_streak ?? 0) },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-white">Suas estatísticas</span>
        <span className="text-[11px] text-muted-foreground">· {played} eventos</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg bg-black/20 border border-border px-3 py-2">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <m.icon size={12} className="text-violet-300" />
              <span className="text-[10px]">{m.label}</span>
            </div>
            <p className="text-lg font-bold text-white">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
