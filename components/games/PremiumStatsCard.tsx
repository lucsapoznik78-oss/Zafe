import Link from "next/link";
import { Crown, Lock, TrendingUp, Flame, Target, Trophy } from "lucide-react";
import type { GamesUserStats } from "@/lib/games/types";

/**
 * Painel de estatísticas avançadas — perk Premium da Zafe Games.
 * O palpite básico continua grátis; só estes números detalhados são gated.
 * Free vê um teaser bloqueado que leva para /premium.
 */
export default function PremiumStatsCard({
  stats,
  isPremium,
}: {
  stats: GamesUserStats | null;
  isPremium: boolean;
}) {
  if (!isPremium) {
    return (
      <Link
        href="/premium"
        className="block rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-violet-500/10 p-4 hover:border-amber-400/50 transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <Lock size={14} className="text-amber-300" />
          <span className="text-sm font-bold text-white">Estatísticas avançadas</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
            <Crown size={10} /> Premium
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Aproveitamento, sequência recorde e desempenho por jogo. Desbloqueie com o Premium.
        </p>
      </Link>
    );
  }

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
    <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-violet-500/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Crown size={14} className="text-amber-300" />
        <span className="text-sm font-bold text-white">Estatísticas avançadas</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
          Premium
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg bg-black/20 border border-border px-3 py-2">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <m.icon size={12} className="text-amber-300" />
              <span className="text-[10px]">{m.label}</span>
            </div>
            <p className="text-lg font-bold text-white">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
