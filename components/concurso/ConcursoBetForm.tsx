"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calcOdds, formatOdds } from "@/lib/odds";
import { Loader2, Trophy } from "lucide-react";
import type { BetSide } from "@/types/database";

interface ConcursoBetFormProps {
  topicId: string;
  poolSim: number;
  poolNao: number;
  isClosed: boolean;
  zcBalance?: number;
}

export default function ConcursoBetForm({
  topicId,
  poolSim,
  poolNao,
  isClosed,
  zcBalance = 0,
}: ConcursoBetFormProps) {
  const router = useRouter();
  const [side, setSide] = useState<BetSide>("sim");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { simOdds, naoOdds } = calcOdds(poolSim, poolNao);
  const amountNum = parseFloat(amount) || 0;
  const currentOdds = side === "sim" ? simOdds : naoOdds;
  const expectedReturn = amountNum * currentOdds;
  const expectedProfit = expectedReturn - amountNum;
  const insufficientBalance = amountNum > zcBalance;

  async function handleBet() {
    setError("");
    setSuccess("");
    if (amountNum < 1) { setError("Valor mínimo: ZC$ 1"); return; }
    if (insufficientBalance) { setError(`Saldo insuficiente. Você tem ZC$ ${zcBalance.toFixed(2)}.`); return; }

    setLoading(true);
    const res = await fetch("/api/concurso/palpitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId, side, amount: amountNum }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao registrar palpite");
    } else {
      setSuccess(`Palpite registrado! Odds estimadas: ${data.estimated_odds?.toFixed(2)}x`);
      setAmount("");
      router.refresh();
    }
  }

  if (isClosed) {
    return (
      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4 text-center">
        <p className="text-yellow-300/70 text-sm">Evento encerrado para palpites</p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-400/5 border border-yellow-400/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-yellow-400" />
          <h3 className="text-sm font-semibold text-yellow-400">Palpite do Concurso</h3>
        </div>
        <span className={`text-xs font-semibold ${insufficientBalance && amountNum > 0 ? "text-red-400" : "text-yellow-300"}`}>
          ZC$ {zcBalance.toFixed(2)}
        </span>
      </div>

      {/* Pool do concurso para este evento */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-green-500/10 rounded-lg px-3 py-2">
          <p className="text-[10px] text-green-400/70 font-medium">POOL SIM</p>
          {poolSim > 0 ? (
            <>
              <p className="text-sm font-bold text-green-400">{formatOdds(simOdds)}</p>
              <p className="text-[10px] text-green-400/60">ZC$ {poolSim.toFixed(0)}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Vazio</p>
          )}
        </div>
        <div className="bg-red-500/10 rounded-lg px-3 py-2">
          <p className="text-[10px] text-red-400/70 font-medium">POOL NÃO</p>
          {poolNao > 0 ? (
            <>
              <p className="text-sm font-bold text-red-400">{formatOdds(naoOdds)}</p>
              <p className="text-[10px] text-red-400/60">ZC$ {poolNao.toFixed(0)}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Vazio</p>
          )}
        </div>
      </div>

      {/* SIM / NÃO */}
      <div className="grid grid-cols-2 gap-2">
        {(["sim", "nao"] as BetSide[]).map((s) => {
          const active = side === s;
          return (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`py-3 rounded-lg font-bold text-sm transition-all ${
                active
                  ? s === "sim"
                    ? "bg-green-500 text-black ring-2 ring-green-500/50"
                    : "bg-red-500 text-white ring-2 ring-red-500/50"
                  : s === "sim"
                    ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              }`}
            >
              {s.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Input */}
      <div>
        <label className="text-xs text-yellow-300/60 mb-1.5 block">Valor em ZC$ (mín. 1)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-400/60 text-sm">ZC$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); setSuccess(""); }}
            placeholder="0"
            min={1}
            step="1"
            className="w-full bg-black/30 border border-yellow-400/30 rounded-lg pl-12 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400/60 transition-colors"
          />
        </div>
        <div className="flex gap-2 mt-2">
          {[50, 100, 200, 500].map((val) => (
            <button
              key={val}
              onClick={() => { setAmount(String(val)); setError(""); }}
              disabled={val > zcBalance}
              className="flex-1 py-1 text-xs bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 rounded transition-colors disabled:opacity-30"
            >
              {val}
            </button>
          ))}
        </div>
        {zcBalance > 0 && (
          <button
            onClick={() => setAmount(Math.floor(zcBalance).toString())}
            className="text-[10px] text-yellow-400/50 hover:text-yellow-400 mt-1 transition-colors"
          >
            Usar tudo
          </button>
        )}
      </div>

      {/* Preview */}
      {amountNum > 0 && (
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-3 space-y-1 text-xs">
          {poolSim > 0 && poolNao > 0 ? (
            <>
              <div className="flex justify-between">
                <span className="text-yellow-300/60">Odds estimadas</span>
                <span className="text-yellow-400 font-bold">{formatOdds(currentOdds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-300/60">Retorno estimado</span>
                <span className="text-yellow-300 font-semibold">ZC$ {expectedReturn.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <p className="text-yellow-300/50">Você será o primeiro neste lado — odds definidas conforme outros entram.</p>
          )}
          <div className="flex justify-between border-t border-yellow-400/10 pt-1">
            <span className="text-yellow-300/50">Lucro potencial</span>
            <span className="text-green-400 font-semibold">+ZC$ {expectedProfit.toFixed(2)}</span>
          </div>
          <p className="text-yellow-300/40 text-[10px]">100% parimutuel — sem comissão nos palpites do concurso.</p>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-yellow-400 text-xs">{success}</p>}

      <button
        onClick={handleBet}
        disabled={loading || !amountNum || insufficientBalance}
        className="w-full py-3 rounded-lg font-bold text-sm bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin mx-auto" />
        ) : insufficientBalance && amountNum > 0 ? (
          "ZC$ insuficiente"
        ) : (
          `Palpite ${side.toUpperCase()}${amountNum > 0 ? ` · ZC$ ${amountNum}` : ""}`
        )}
      </button>
    </div>
  );
}
