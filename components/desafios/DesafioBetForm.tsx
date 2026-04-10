"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { formatOdds } from "@/lib/odds";
import { Loader2 } from "lucide-react";

interface Props {
  desafioId: string;
  minBet: number;
  totalSim: number;
  totalNao: number;
  isClosed: boolean;
  userBalance: number;
  isCreator: boolean;
  initialSide?: "sim" | "nao";
}

export default function DesafioBetForm({
  desafioId, minBet, totalSim, totalNao, isClosed, userBalance, isCreator, initialSide,
}: Props) {
  const [side, setSide] = useState<"sim" | "nao">(initialSide ?? "sim");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasBothSides = totalSim > 0 && totalNao > 0;
  const totalPool = totalSim + totalNao;

  function simOdds() {
    if (!hasBothSides) return 2.0;
    const totalAfter = totalPool + parseFloat(amount || "0");
    const simAfter = totalSim + (side === "sim" ? parseFloat(amount || "0") : 0);
    const naoAfter = totalNao + (side === "nao" ? parseFloat(amount || "0") : 0);
    if (simAfter === 0) return 2.0;
    return parseFloat(((simAfter + naoAfter) * 0.88 / simAfter).toFixed(2));
  }
  function naoOdds() {
    if (!hasBothSides) return 2.0;
    const naoAfter = totalNao + (side === "nao" ? parseFloat(amount || "0") : 0);
    const simAfter = totalSim + (side === "sim" ? parseFloat(amount || "0") : 0);
    if (naoAfter === 0) return 2.0;
    return parseFloat(((simAfter + naoAfter) * 0.88 / naoAfter).toFixed(2));
  }

  const currentOdds = side === "sim" ? simOdds() : naoOdds();
  const potentialReturn = amount ? parseFloat(amount) * currentOdds : 0;

  async function handleBet() {
    setError("");
    setSuccess("");
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < minBet) {
      setError(`Aposta mínima: ${formatCurrency(minBet)}`);
      return;
    }
    if (amt > userBalance) {
      setError("Saldo insuficiente");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/desafios/${desafioId}/apostar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, amount: amt }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao apostar");
    } else {
      setSuccess(`Aposta ${side.toUpperCase()} registrada!`);
      setAmount("");
      setTimeout(() => window.location.reload(), 1200);
    }
  }

  if (isCreator) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <p className="text-sm text-muted-foreground">Você criou este desafio.</p>
        <p className="text-xs text-muted-foreground mt-1">Criadores não podem apostar no próprio desafio.</p>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center">
        <p className="text-sm text-muted-foreground">Apostas encerradas</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <p className="text-sm font-semibold text-white">Fazer aposta</p>

      {/* Selector SIM/NÃO */}
      <div className="grid grid-cols-2 gap-2">
        {(["sim", "nao"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`py-2.5 rounded-lg text-sm font-bold transition-colors border ${
              side === s
                ? s === "sim"
                  ? "bg-sim/20 border-sim text-sim"
                  : "bg-nao/20 border-nao text-nao"
                : "bg-transparent border-border text-muted-foreground hover:border-white/30"
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Valor */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Valor (Z$)</label>
          <span className="text-xs text-muted-foreground">Saldo: {formatCurrency(userBalance)}</span>
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={minBet}
          step="0.50"
          placeholder={`Mín. ${formatCurrency(minBet)}`}
          className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        <div className="flex gap-1.5 flex-wrap">
          {[5, 10, 25, 50].filter(v => v >= minBet).map(v => (
            <button key={v} onClick={() => setAmount(String(v))}
              className="px-2 py-1 text-[10px] rounded bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors">
              +{v}
            </button>
          ))}
        </div>
      </div>

      {/* Retorno estimado */}
      {amount && parseFloat(amount) > 0 && (
        <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Odds</span>
            <span className="text-white font-bold">{formatOdds(currentOdds)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Retorno potencial</span>
            <span className="text-sim font-bold">{formatCurrency(potentialReturn)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">88% do pool distribuído — 6% criador + 6% Zafe</p>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
      {success && <p className="text-sim text-xs">{success}</p>}

      <button
        onClick={handleBet}
        disabled={loading || !amount}
        className={`w-full py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          side === "sim"
            ? "bg-sim text-black hover:bg-sim/90"
            : "bg-nao text-white hover:bg-nao/90"
        }`}
      >
        {loading
          ? <Loader2 size={16} className="animate-spin mx-auto" />
          : `Apostar ${side.toUpperCase()}`
        }
      </button>
    </div>
  );
}
