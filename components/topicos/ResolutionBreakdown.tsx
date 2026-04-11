"use client";

import { formatCurrency } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface Props {
  totalVolume: number;
  totalSim: number;
  totalNao: number;
  resolution: "sim" | "nao";
  proofUrl?: string | null;
  proofLabel?: string | null;
  resolvedBy?: string | null;
}

export default function ResolutionBreakdown({
  totalVolume, totalSim, totalNao, resolution, proofUrl, proofLabel, resolvedBy,
}: Props) {
  const COMMISSION = 0.04;
  const commission = totalVolume * COMMISSION;
  const toWinners = totalVolume - commission;
  const winPool = resolution === "sim" ? totalSim : totalNao;
  const losePool = resolution === "sim" ? totalNao : totalSim;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <p className="text-sm font-semibold text-white">Distribuição final</p>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total apostado</span>
          <span className="text-white font-semibold">{formatCurrency(totalVolume)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pool {resolution.toUpperCase()} (vencedores)</span>
          <span className="text-sim">{formatCurrency(winPool)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pool {resolution === "sim" ? "NÃO" : "SIM"} (perdedores)</span>
          <span className="text-nao">{formatCurrency(losePool)}</span>
        </div>
        <div className="border-t border-border/40 pt-2 flex justify-between">
          <span className="text-muted-foreground">Comissão Zafe (4%)</span>
          <span className="text-muted-foreground">{formatCurrency(commission)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Distribuído aos vencedores</span>
          <span className="text-sim font-bold">{formatCurrency(toWinners)}</span>
        </div>
      </div>

      {/* Fonte de resolução */}
      {(proofUrl || resolvedBy) && (
        <div className="border-t border-border/40 pt-3 space-y-1">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Resolução</p>
          <p className="text-xs text-muted-foreground">
            Por: {resolvedBy === "oracle_ai" ? "Oracle AI (Claude)" : resolvedBy === "oracle_api" ? "Oracle API" : resolvedBy ?? "sistema"}
          </p>
          {proofUrl && (
            <a href={proofUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink size={11} />
              {proofLabel ?? "Ver fonte usada"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
