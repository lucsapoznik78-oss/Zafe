"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, applyCommission, commissionAmount } from "@/lib/utils";
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export default function DepositSection({ currentBalance }: { currentBalance: number }) {
  const router = useRouter();
  const [tab, setTab] = useState<"depositar" | "sacar">("depositar");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const netAmount = applyCommission(amountNum);
  const commission = commissionAmount(amountNum);

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
      setMessage({ type: "error", text: data.error ?? "Erro na operação" });
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
            <span className="inline-block mb-1.5 px-2 py-0.5 rounded bg-yellow-400/15 text-yellow-400 text-[10px] font-semibold">
              Modo beta — Zafes não têm valor real
            </span>
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
          <div className="bg-muted rounded-lg p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Você deposita</span>
              <span className="text-white">{formatCurrency(amountNum)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Comissão Zafe (4%)</span>
              <span className="text-nao">- {formatCurrency(commissionAmount(amountNum))}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold">
              <span className="text-white">Entra na carteira</span>
              <span className="text-primary">{formatCurrency(applyCommission(amountNum))}</span>
            </div>
          </div>
        )}

        {amountNum > 0 && tab === "sacar" && amountNum > currentBalance && (
          <p className="text-destructive text-xs">Saldo insuficiente</p>
        )}

        {message && (
          <p className={`text-xs ${message.type === "success" ? "text-primary" : "text-destructive"}`}>
            {message.text}
          </p>
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
