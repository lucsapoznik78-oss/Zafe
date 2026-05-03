"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { calcOdds, formatOdds } from "@/lib/odds";
import { Loader2, Wallet, Lock } from "lucide-react";
import type { BetSide } from "@/types/database";

interface BetFormProps {
  topicId: string;
  minBet: number;
  totalSim: number;
  totalNao: number;
  isClosed: boolean;
  userBalance?: number;
  initialSide?: "sim" | "nao";
}

export default function BetForm({ topicId, minBet, totalSim, totalNao, isClosed, userBalance = 0, initialSide }: BetFormProps) {
  const router = useRouter();
  const [side, setSide] = useState<BetSide>(initialSide ?? "sim");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { simOdds, naoOdds } = calcOdds(totalSim, totalNao);
  const effectiveMin = Math.max(1, minBet);
  const amountNum = parseFloat(amount) || 0;
  const currentOdds = side === "sim" ? simOdds : naoOdds;
  const expectedReturn = amountNum * currentOdds;
  const expectedProfit = expectedReturn - amountNum;
  const insufficientBalance = amountNum > userBalance;

  async function handleBet() {
    setError("");
    setSuccess("");

    if (amountNum < effectiveMin) {
      setError(`Valor mínimo: ${formatCurrency(effectiveMin)}`);
      return;
    }
    if (insufficientBalance) {
      setError(`Saldo insuficiente. Você tem ${formatCurrency(userBalance)}.`);
      return;
    }

    setLoading(true);
    const res = await fetch("/api/apostar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId, side, amount: amountNum }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao registrar palpite");
    } else {
      setSuccess(`Palpite registrado! Probabilidade estimada: ${(data.estimated_odds ? (1/data.estimated_odds*100).toFixed(0) : "—")}%. O retorno final depende do volume na resolução.`);
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
        {/* Saldo do usuário */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wallet size={11} />
          <span className={insufficientBalance && amountNum > 0 ? "text-destructive font-semibold" : ""}>
            {formatCurrency(userBalance)}
          </span>
        </div>
      </div>

      {/* Pool atual */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-sim/10 rounded-lg px-3 py-2">
          <p className="text-[10px] text-sim/70 font-medium">POOL SIM</p>
          {totalSim > 0 ? (
            <>
              <p className="text-sm font-bold text-sim">{formatOdds(simOdds)}</p>
              <p className="text-[10px] text-sim/60">{formatCurrency(totalSim)}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Sem palpites</p>
          )}
        </div>
        <div className="bg-nao/10 rounded-lg px-3 py-2">
          <p className="text-[10px] text-nao/70 font-medium">POOL NÃO</p>
          {totalNao > 0 ? (
            <>
              <p className="text-sm font-bold text-nao">{formatOdds(naoOdds)}</p>
              <p className="text-[10px] text-nao/60">{formatCurrency(totalNao)}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Sem palpites</p>
          )}
        </div>
      </div>

      {/* Botões SIM / NÃO */}
      <div className="grid grid-cols-2 gap-2">
        {(["sim", "nao"] as BetSide[]).map((s) => {
          const active = side === s;
          const colorClass = s === "sim" ? "sim" : "nao";
          return (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`py-3 rounded-lg font-bold text-sm transition-all ${
                active
                  ? `bg-${colorClass} text-black ring-2 ring-${colorClass}/50`
                  : `bg-${colorClass}/10 text-${colorClass} hover:bg-${colorClass}/20`
              }`}
            >
              {s.toUpperCase()}
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
        {userBalance > 0 && (
          <button
            onClick={() => setAmount(userBalance.toFixed(2))}
            className="text-[10px] text-muted-foreground/60 hover:text-primary mt-1 transition-colors"
          >
            Usar saldo máximo
          </button>
        )}
      </div>

      {/* Preview do retorno — só mostra odds se há apostas dos dois lados */}
      {amountNum > 0 && (
        <div className="bg-muted rounded-lg p-3 space-y-1.5 text-xs">
          {totalSim > 0 && totalNao > 0 ? (
            <>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Lock size={10} />
                  Probabilidade estimada {side.toUpperCase()}
                </span>
                <span className="text-white font-bold">{formatOdds(currentOdds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retorno estimado se ganhar</span>
                <span className="text-primary font-semibold">{formatCurrency(expectedReturn)}</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Você será o primeiro a palpitar neste lado. As probabilidades serão definidas conforme outros entrarem.
            </p>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lucro potencial</span>
            <span className="text-sim font-semibold">+{formatCurrency(expectedProfit)}</span>
          </div>
          <p className="text-muted-foreground/50 text-[10px]">
            Estimativa com base no pool atual. Muda conforme mais pessoas palpitam. Retorno final é proporcional — sem comissão.
          </p>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
      {success && <p className="text-sim text-xs">{success}</p>}

      <button
        onClick={handleBet}
        disabled={loading || !amountNum || insufficientBalance}
        className="w-full py-3 rounded-lg font-bold text-sm bg-primary text-black hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin mx-auto" />
        ) : insufficientBalance && amountNum > 0 ? (
          "Saldo insuficiente"
        ) : (
          `Palpitar ${side.toUpperCase()}${amountNum > 0 ? ` · ${formatCurrency(amountNum)}` : ""}`
        )}
      </button>
    </div>
  );
}
