import { Shield } from "lucide-react";
import RankBadge from "@/components/games/RankBadge";
import {
  TIER_THRESHOLDS,
  tierForWins,
  nextTierProgress,
} from "@/lib/games/types";

/**
 * Nível do usuário no perfil — mesma escada de ranks da Zafe Games
 * (Ferro → Bronze → Prata → Ouro → Platina → Diamante → Mestre), mas
 * contando TODAS as vitórias na plataforma (palpites certos + Games).
 */
export default function NivelSection({ totalWins }: { totalWins: number }) {
  const tier = tierForWins(totalWins);
  const prog = nextTierProgress(totalWins);

  // Escada em ordem crescente para exibir a progressão completa.
  const ladder = [...TIER_THRESHOLDS].sort((a, b) => a.minWins - b.minWins);
  const currentIdx = ladder.findIndex((t) => t.tier === tier);

  const span = prog ? prog.nextFloor - prog.currentFloor : 1;
  const done = prog ? totalWins - prog.currentFloor : 1;
  const pct = prog ? Math.min(100, Math.round((done / span) * 100)) : 100;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Shield size={15} className="text-primary" />
        <h3 className="text-sm font-semibold text-white">Seu nível</h3>
        <span className="ml-auto"><RankBadge tier={tier} size="md" /></span>
      </div>

      {/* Escada de níveis em ordem */}
      <div className="flex items-center gap-1 flex-wrap text-[11px] font-bold">
        {ladder.map((t, i) => (
          <span key={t.tier} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/40">→</span>}
            <span
              className={
                i < currentIdx
                  ? "text-muted-foreground/60"
                  : i === currentIdx
                    ? "text-primary"
                    : "text-muted-foreground"
              }
            >
              {t.label}
            </span>
          </span>
        ))}
      </div>

      {prog ? (
        <>
          <p className="text-xs text-muted-foreground">
            Você tem <span className="text-white font-semibold">{totalWins}</span>{" "}
            {totalWins === 1 ? "acerto" : "acertos"}. Acerte mais{" "}
            <span className="text-primary font-semibold">{prog.winsNeeded}</span> para virar{" "}
            <span className="text-white font-semibold">{prog.label}</span>.
          </p>
          <div className="h-2 rounded-full bg-black/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-right">
            {totalWins} / {prog.nextFloor} acertos
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Você atingiu o nível máximo com{" "}
          <span className="text-white font-semibold">{totalWins}</span> acertos. Lenda da Zafe.
        </p>
      )}
    </div>
  );
}
