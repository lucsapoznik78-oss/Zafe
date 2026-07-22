"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { playWin, playWrong } from "@/lib/sound";

interface Bet {
  id: string;
  side: string;
  amount: number;
  status: string;
  potential_payout?: number | null;
}

interface Props {
  bets: Bet[];
  resolution: string | null;
  /** Mercados multi: label do resultado vencedor (substitui SIM/NÃO) */
  winningLabel?: string | null;
}

/** Anima um valor de 0 até `target` com ease-out (~1.2s) */
function useCountUp(target: number) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    function frame(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(frame);
    }
    raf.current = requestAnimationFrame(frame);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target]);

  return value;
}

function WinBanner({
  totalPayout,
  totalInvested,
  profit,
  side,
  betIds,
}: {
  totalPayout: number;
  totalInvested: number;
  profit: number;
  side?: string;
  betIds: string;
}) {
  const animated = useCountUp(totalPayout);

  // Som de vitória só na primeira vez que o usuário vê este resultado
  useEffect(() => {
    const key = `zafe_win_seen_${betIds}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      playWin();
    }
  }, [betIds]);

  return (
    <div className="relative overflow-hidden bg-sim/10 border border-sim/40 rounded-xl px-5 py-4 flex items-center gap-4">
      {/* Varredura dourada de celebração */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-yellow-300/15 to-transparent"
      />
      <div className="w-10 h-10 rounded-full bg-sim/20 flex items-center justify-center shrink-0">
        <TrendingUp size={20} className="text-sim" />
      </div>
      <div>
        <p className="text-sim font-bold text-base tabular-nums">
          Você ganhou {formatCurrency(animated)}!
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Investiu {formatCurrency(totalInvested)}
          {side ? ` em ${side}` : ""} · lucro líquido{" "}
          {formatCurrency(profit > 0 ? profit : totalPayout - totalInvested)}
        </p>
      </div>
    </div>
  );
}

function LossBanner({ totalLost, resolution, betIds }: { totalLost: number; resolution: string | null; betIds: string }) {
  // Som de erro só na primeira vez que o usuário vê este resultado
  useEffect(() => {
    const key = `zafe_loss_seen_${betIds}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      playWrong();
    }
  }, [betIds]);

  return (
    <div className="bg-nao/10 border border-nao/30 rounded-xl px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-nao/20 flex items-center justify-center shrink-0">
        <TrendingDown size={20} className="text-nao" />
      </div>
      <div>
        <p className="text-nao font-bold text-base">Você perdeu {formatCurrency(totalLost)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          O resultado foi {resolution} — boa sorte na próxima!
        </p>
      </div>
    </div>
  );
}

export default function UserResultBanner({ bets, resolution, winningLabel }: Props) {
  if (!bets || bets.length === 0) return null;

  // Texto do resultado: label do outcome (multi) ou SIM/NÃO (binário)
  const resultText = winningLabel ?? (resolution ? resolution.toUpperCase() : null);

  const wonBets = bets.filter((b) => b.status === "won");
  const lostBets = bets.filter((b) => b.status === "lost");
  const refundedBets = bets.filter((b) => b.status === "refunded");

  if (wonBets.length === 0 && lostBets.length === 0 && refundedBets.length === 0) return null;

  const totalPayout = wonBets.reduce((s, b) => s + (b.potential_payout ?? 0), 0);
  const totalInvested = bets.reduce((s, b) => s + parseFloat(String(b.amount)), 0);
  const totalLost = lostBets.reduce((s, b) => s + parseFloat(String(b.amount)), 0);
  const totalRefunded = refundedBets.reduce((s, b) => s + parseFloat(String(b.amount)), 0);

  if (wonBets.length > 0) {
    const profit = totalPayout - totalInvested + totalLost;
    return (
      <WinBanner
        totalPayout={totalPayout}
        totalInvested={totalInvested}
        profit={profit}
        side={winningLabel ?? (wonBets[0]?.side ? wonBets[0].side.toUpperCase() : undefined)}
        betIds={wonBets.map((b) => b.id).join("_")}
      />
    );
  }

  if (refundedBets.length > 0) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
          <RotateCcw size={20} className="text-yellow-400" />
        </div>
        <div>
          <p className="text-yellow-400 font-bold text-base">Reembolso de {formatCurrency(totalRefunded)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Setor cancelado ou sem cobertura</p>
        </div>
      </div>
    );
  }

  return (
    <LossBanner
      totalLost={totalLost}
      resolution={resultText}
      betIds={lostBets.map((b) => b.id).join("_")}
    />
  );
}
