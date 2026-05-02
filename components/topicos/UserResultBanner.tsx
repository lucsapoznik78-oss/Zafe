"use client";

import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, RotateCcw } from "lucide-react";

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
}

export default function UserResultBanner({ bets, resolution }: Props) {
  if (!bets || bets.length === 0) return null;

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
      <div className="bg-sim/10 border border-sim/40 rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-sim/20 flex items-center justify-center shrink-0">
          <TrendingUp size={20} className="text-sim" />
        </div>
        <div>
          <p className="text-sim font-bold text-base">Você ganhou {formatCurrency(totalPayout)}!</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Investiu {formatCurrency(totalInvested)} no {wonBets[0]?.side?.toUpperCase()} · lucro líquido {formatCurrency(profit > 0 ? profit : totalPayout - totalInvested)}
          </p>
        </div>
      </div>
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
    <div className="bg-nao/10 border border-nao/30 rounded-xl px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-nao/20 flex items-center justify-center shrink-0">
        <TrendingDown size={20} className="text-nao" />
      </div>
      <div>
        <p className="text-nao font-bold text-base">Você perdeu {formatCurrency(totalLost)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          O resultado foi {resolution?.toUpperCase()} — boa sorte na próxima!
        </p>
      </div>
    </div>
  );
}
