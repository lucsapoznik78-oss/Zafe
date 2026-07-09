"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Loader2, Wallet } from "lucide-react";
import { playConfirm } from "@/lib/sound";

interface Outcome {
  id: string;
  label: string;
  pool: number;
}

interface MultiOutcomeBetFormProps {
  topicId: string;
  minBet: number;
  outcomes: Outcome[];
  isClosed: boolean;
  userBalance?: number;
}

export default function MultiOutcomeBetForm({
  topicId,
  minBet,
  outcomes,
  isClosed,
  userBalance = 0,
}: MultiOutcomeBetFormProps) {
  const router = useRouter();
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(outcomes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const effectiveMin = Math.max(1, minBet);
  const amountNum = parseFloat(amount) || 0;
  const insufficientBalance = amountNum > userBalance;

  const totalPool = outcomes.reduce((s, o) => s + o.pool, 0);
  const selectedOutcome = outcomes.find((o) => o.id === selectedOutcomeId);
  const selectedPool = selectedOutcome?.pool ?? 0;
  const estimatedOdds =
    totalPool + amountNum > 0 && selectedPool + amountNum > 0
      ? (totalPool + amountNum) / (selectedPool + amountNum)
      : 1;
  const expectedReturn = amountNum * estimatedOdds;

  async function handleBet() {
    setError("");
    setSuccess("");
    if (!selectedOutcomeId) { setError("Selecione um resultado"); return; }
    if (amountNum < effectiveMin) { setError(`Valor mínimo: ${formatCurrency(effectiveMin)}`); return; }
    if (insufficientBalance) { setError(`Saldo insuficiente. Você tem ${formatCurrency(userBalance)}.`); return; }

    setLoading(true);
    const res = await fetch("/api/apostar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId, outcome_id: selectedOutcomeId, amount: amountNum }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao registrar palpite");
    } else {
      setSuccess("Palpite registrado! O retorno final depende do volume na resolução.");
      playConfirm();
      setAmount("");
      router.refresh();
    }
  }

  if (isClosed) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center space-y-1">
        <p className="text-muted-foreground text-sm font-medium">Setor encerrado</p>
        <p className="text-xs text-muted-foreground">O prazo para palpitar neste setor já passou.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Fazer Palpite</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wallet size={11} />
          <span className={insufficientBalance && amountNum > 0 ? "text-destructive font-semibold" : ""}>
            {formatCurrency(userBalance)}
          </span>
        </div>
      </div>

      {/* Pool total */}
      <div className="bg-muted/40 rounded-lg px-3 py-2 text-center">
        <p className="text-[10px] text-muted-foreground font-medium">POOL TOTAL</p>
        <p className="text-sm font-bold text-white">{formatCurrency(totalPool)}</p>
      </div>

      {/* Outcomes */}
      <div className="space-y-2">
        {outcomes.map((o) => {
          const active = selectedOutcomeId === o.id;
          const prob = totalPool > 0 ? ((o.pool / totalPool) * 100).toFixed(1) : "—";
          return (
            <button
              key={o.id}
              onClick={() => setSelectedOutcomeId(o.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all text-left ${
                active
                  ? "bg-primary/20 border-primary text-white ring-1 ring-primary/40"
                  : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40 hover:text-white"
              }`}
            >
              <span className="font-medium flex-1 pr-2">{o.label}</span>
              <div className="flex gap-3 text-xs shrink-0">
                <span className={active ? "text-primary font-bold" : "text-muted-foreground"}>{prob}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Input de valor */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">
          Valor (mín. {formatCurrency(effectiveMin)})
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Z$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); setSuccess(""); }}
            placeholder="0,00"
            min={effectiveMin}
            step="0.01"
            className={`w-full bg-input border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none transition-colors ${
              insufficientBalance && amountNum > 0 ? "border-destructive/50 focus:border-destructive" : "border-border focus:border-primary/50"
            }`}
          />
        </div>
        <div className="flex gap-2 mt-2">
          {[10, 25, 50, 100].map((val) => (
            <button
              key={val}
              onClick={() => { setAmount(String(val)); setError(""); }}
              disabled={val > userBalance}
              className="flex-1 py-1 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded transition-colors disabled:opacity-30"
            >
              Z${val}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {amountNum > 0 && selectedOutcome && (
        <div className="bg-muted rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resultado selecionado</span>
            <span className="text-white font-semibold truncate max-w-[140px]">{selectedOutcome.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Retorno estimado</span>
            <span className="text-primary font-semibold">{formatCurrency(expectedReturn)}</span>
          </div>
          <p className="text-muted-foreground/50 text-[10px]">
            Estimativa com base no pool atual. Muda conforme mais pessoas palpitam.
          </p>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
      {success && <p className="text-sim text-xs">{success}</p>}

      <button
        onClick={handleBet}
        disabled={loading || !amountNum || insufficientBalance || !selectedOutcomeId}
        className="w-full py-3 rounded-lg font-bold text-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin mx-auto" />
        ) : insufficientBalance && amountNum > 0 ? (
          "Saldo insuficiente"
        ) : (
          `Palpitar${selectedOutcome ? ` · ${selectedOutcome.label.slice(0, 20)}` : ""}${amountNum > 0 ? ` · ${formatCurrency(amountNum)}` : ""}`
        )}
      </button>
    </div>
  );
}
