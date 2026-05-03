"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  topicId?: string;
  chartUrl?: string;
  initialSim: number;
  initialNao: number;
  initialBetCount: number;
  isResolved?: boolean;
}

export default function LiveStats({ topicId, chartUrl, initialSim, initialNao, initialBetCount, isResolved }: Props) {
  const resolvedChartUrl = chartUrl ?? (topicId ? `/api/topicos/${topicId}/chart` : null);
  const [sim, setSim] = useState(initialSim);
  const [nao, setNao] = useState(initialNao);
  const [betCount, setBetCount] = useState(initialBetCount);
  const [pulse, setPulse] = useState(false);
  const prevTotal = useRef(initialSim + initialNao);

  const totalVolume = sim + nao;
  const hasBothSides = sim > 0 && nao > 0;
  const probSim = hasBothSides ? (sim / totalVolume) * 100 : 50;
  const probNao = 100 - probSim;

  useEffect(() => {
    if (isResolved) return;
    const interval = setInterval(async () => {
      try {
        if (!resolvedChartUrl) return;
        const res = await fetch(resolvedChartUrl);
        if (!res.ok) return;
        const json = await res.json();
        const s = json.stats;
        if (!s) return;
        const newSim = parseFloat(s.volume_sim ?? "0");
        const newNao = parseFloat(s.volume_nao ?? "0");
        const newTotal = newSim + newNao;
        const newCount = parseInt(s.bet_count ?? "0");
        if (newTotal !== prevTotal.current) {
          setPulse(true);
          setTimeout(() => setPulse(false), 800);
          prevTotal.current = newTotal;
        }
        setSim(newSim);
        setNao(newNao);
        setBetCount(newCount);
      } catch {}
    }, 15_000);
    return () => clearInterval(interval);
  }, [resolvedChartUrl, isResolved]);

  return (
    <div className="space-y-3">
      {/* Barra de probabilidade animada */}
      {hasBothSides && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-sim">SIM {probSim.toFixed(1)}%</span>
            <span className="text-nao">NÃO {probNao.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-nao overflow-hidden">
            <div
              className="h-full rounded-full bg-sim transition-all duration-700 ease-out"
              style={{ width: `${probSim}%` }}
            />
          </div>
        </div>
      )}

      {/* Volume + apostadores */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className={`transition-all duration-300 ${pulse ? "text-primary font-bold scale-105" : ""}`}>
          {totalVolume > 0
            ? <>{formatCurrency(totalVolume)} no pool</>
            : "Sem palpites ainda"
          }
        </span>
        {betCount > 0 && (
          <span>{betCount} {betCount === 1 ? "palpite" : "palpites"}</span>
        )}
      </div>
    </div>
  );
}
