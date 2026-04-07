"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!targetIso) { setRemaining(""); return; }
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setRemaining(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  return remaining;
}

export default function DepositSection({ currentBalance }: { currentBalance: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<"depositar" | "sacar">("depositar");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [nextDepositAt, setNextDepositAt] = useState<string | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const countdown = useCountdown(nextDepositAt);

  // Auto-refresh quando o tempo de bloqueio acabar
  useEffect(() => {
    if (!nextDepositAt) return;
    const diff = new Date(nextDepositAt).getTime() - Date.now();
    if (diff <= 0) { router.refresh(); return; }
    refreshTimer.current = setTimeout(() => { router.refresh(); }, diff);
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [nextDepositAt, router]);

  const amountNum = parseFloat(amount) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amountNum <= 0) return;
    setLoading(true);
    setMessage(null);

    const endpoint = tab === "depositar" ? "/api/depositar" : "/api/sacar";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountNum }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (data.error === "limite_semanal" && data.nextDepositAt) {
        setNextDepositAt(data.nextDepositAt);
        const d = new Date(data.nextDepositAt);
        const dia = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
        const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        setMessage({ type: "error", text: `Próximo depósito disponível em ${dia} às ${hora}.` });
      } else {
        setMessage({ type: "error", text: data.error ?? "Erro na operação" });
      }
    } else {
      setMessage({ type: "success", text: tab === "depositar" ? "Depósito realizado!" : "Saque solicitado!" });
      setAmount("");
      router.refresh();
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex border border-border rounded-lg p-1 gap-1">
        <button
          onClick={() => setTab("depositar")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "depositar" ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
          }`}
        >
          <ArrowDownToLine size={14} />
          Depositar
        </button>
        <button
          onClick={() => setTab("sacar")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "sacar" ? "bg-primary text-black" : "text-muted-foreground hover:text-white"
          }`}
        >
          <ArrowUpFromLine size={14} />
          Sacar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">
            {tab === "depositar" ? "Zafes a adicionar (máx. Z$ 1.000)" : "Valor a sacar"}
          </label>
          {tab === "depositar" && (
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              <span className="px-2 py-0.5 rounded bg-yellow-400/15 text-yellow-400 text-[10px] font-semibold">
                Modo beta — Zafes não têm valor real
              </span>
              <span className="px-2 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-semibold">
                1 depósito por semana · máx. Z$ 1.000
              </span>
            </div>
          )}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Z$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              min="1"
              step="0.01"
              className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {[50, 100, 200, 500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className="flex-1 py-1.5 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded transition-colors"
              >
                Z${v}
              </button>
            ))}
          </div>
        </div>

        {amountNum > 0 && tab === "depositar" && (
          <div className="bg-muted rounded-lg p-3 text-xs flex justify-between">
            <span className="text-muted-foreground">Entra na carteira</span>
            <span className="text-primary font-semibold">{formatCurrency(amountNum)}</span>
          </div>
        )}

        {amountNum > 0 && tab === "sacar" && amountNum > currentBalance && (
          <p className="text-destructive text-xs">Saldo insuficiente</p>
        )}

        {message && (
          <div className={`text-xs ${message.type === "success" ? "text-primary" : "text-destructive"}`}>
            <p>{message.text}</p>
            {countdown && <p className="mt-0.5 font-mono text-muted-foreground">{countdown}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !amountNum || (tab === "sacar" && amountNum > currentBalance)}
          className="w-full py-3 bg-primary text-black font-bold rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : tab === "depositar" ? "Confirmar Depósito" : "Confirmar Saque"}
        </button>
      </form>
    </div>
  );
}
