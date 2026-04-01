"use client";

import { formatCurrency } from "@/lib/utils";
import { DollarSign, Clock, CheckSquare, RefreshCw } from "lucide-react";
import { useState } from "react";

interface Props {
  totalCommission: number;
  pendingCount: number;
  toResolveCount: number;
}

export default function AdminStats({ totalCommission, pendingCount, toResolveCount }: Props) {
  const [cronLoading, setCronLoading] = useState(false);
  const [cronResult, setCronResult] = useState("");

  async function runCron() {
    setCronLoading(true);
    setCronResult("");
    const res = await fetch("/api/cron/fechar-mercados", { method: "POST" });
    const data = await res.json();
    setCronResult(
      res.ok
        ? `✅ ${data.expired_topics ?? 0} expirados fechados, ${data.snapshots_taken ?? 0} snapshots tirados`
        : `❌ ${data.error}`
    );
    setCronLoading(false);
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <DollarSign size={18} />, label: "Saldo total na plataforma", value: formatCurrency(totalCommission), color: "text-primary" },
          { icon: <Clock size={18} />, label: "Tópicos aguardando aprovação", value: pendingCount, color: "text-yellow-400" },
          { icon: <CheckSquare size={18} />, label: "Contradições oracle (revisão manual)", value: toResolveCount, color: "text-yellow-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`mb-2 ${stat.color}`}>{stat.icon}</div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Botão de manutenção */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Manutenção diária</p>
          <p className="text-xs text-muted-foreground">
            Fecha mercados expirados, reembolsa não-matcheadas, tira snapshot das odds.
          </p>
          {cronResult && <p className="text-xs mt-1 text-primary">{cronResult}</p>}
        </div>
        <button
          onClick={runCron}
          disabled={cronLoading}
          className="flex items-center gap-2 px-4 py-2 bg-muted text-white text-sm rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors shrink-0"
        >
          <RefreshCw size={14} className={cronLoading ? "animate-spin" : ""} />
          {cronLoading ? "Rodando..." : "Rodar agora"}
        </button>
      </div>
    </div>
  );
}
