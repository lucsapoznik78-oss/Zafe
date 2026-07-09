"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";
import { playConfirm } from "@/lib/sound";
import type { BetSide } from "@/types/database";

interface Outcome {
  id: string;
  label: string;
  pool: number;
}

interface ConcursoBetFormProps {
  topicId: string;
  poolSim: number;
  poolNao: number;
  isClosed: boolean;
  zcBalance?: number;
  isMulti?: boolean;
  outcomes?: Outcome[];
}

export default function ConcursoBetForm({
  topicId,
  poolSim,
  poolNao,
  isClosed,
  zcBalance = 0,
  isMulti = false,
  outcomes = [],
}: ConcursoBetFormProps) {
  const router = useRouter();
  const [side, setSide] = useState<BetSide>("sim");
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(outcomes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const amountNum = parseFloat(amount) || 0;
  const totalPool = poolSim + poolNao;
  const sidePool = side === "sim" ? poolSim : poolNao;
  const probSimPct = totalPool > 0 ? (poolSim / totalPool * 100).toFixed(1) : null;
  const probNaoPct = totalPool > 0 ? (poolNao / totalPool * 100).toFixed(1) : null;
  const currentProbPct = totalPool > 0 ? (sidePool / totalPool * 100).toFixed(1) : null;
  // Payout parimutuel real: o palpite entra no pool antes do rateio, então o
  // denominador é (pool do lado + valor). Usar odds de mercado puras inflava o
  // retorno e, ao ser o primeiro de um lado (sidePool=0), estourava para 999x.
  const currentOdds = amountNum > 0 && sidePool + amountNum > 0
    ? (totalPool + amountNum) / (sidePool + amountNum)
    : 0;
  const expectedReturn = amountNum * currentOdds;
  const expectedProfit = expectedReturn - amountNum;
  const insufficientBalance = amountNum > zcBalance;

  // Multi odds
  const totalMultiPool = outcomes.reduce((s, o) => s + o.pool, 0);
  const selectedOutcome = outcomes.find((o) => o.id === selectedOutcomeId);
  const selectedPool = selectedOutcome?.pool ?? 0;
  const multiOdds = totalMultiPool + amountNum > 0 && selectedPool + amountNum > 0
    ? (totalMultiPool + amountNum) / (selectedPool + amountNum)
    : 1;
  const multiReturn = amountNum * multiOdds;

  async function handleBet() {
    setError("");
    setSuccess("");
    if (amountNum < 1) { setError("Valor mínimo: Z$ 1"); return; }
    if (insufficientBalance) { setError(`Saldo insuficiente. Você tem Z$ ${zcBalance.toFixed(2)}.`); return; }
    if (isMulti && !selectedOutcomeId) { setError("Selecione um resultado"); return; }

    setLoading(true);
    const body: Record<string, any> = { topic_id: topicId, amount: amountNum };
    if (isMulti) { body.outcome_id = selectedOutcomeId; }
    else { body.side = side; }

    const res = await fetch("/api/concurso/palpitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao registrar palpite");
    } else {
      setSuccess(`Palpite registrado! Retorno estimado: Z$ ${(amountNum * (data.estimated_odds ?? 1)).toFixed(2)}`);
      playConfirm();
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
          Z$ {zcBalance.toFixed(2)}
        </span>
      </div>

      {isMulti ? (
        /* Multi: pool total + lista de outcomes */
        <div className="space-y-2">
          <div className="bg-yellow-400/10 rounded-lg px-3 py-2 text-center">
            <p className="text-[10px] text-yellow-300/60 font-medium">POOL TOTAL</p>
            <p className="text-sm font-bold text-yellow-300">Z$ {totalMultiPool.toFixed(0)}</p>
          </div>
          {outcomes.map((o) => {
            const active = selectedOutcomeId === o.id;
            const prob = totalMultiPool > 0 ? ((o.pool / totalMultiPool) * 100).toFixed(1) : "—";
            return (
              <button
                key={o.id}
                onClick={() => setSelectedOutcomeId(o.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all text-left ${
                  active
                    ? "bg-yellow-400/20 border-yellow-400 text-white ring-1 ring-yellow-400/40"
                    : "bg-yellow-400/5 border-yellow-400/20 text-yellow-300/70 hover:border-yellow-400/40 hover:text-yellow-200"
                }`}
              >
                <span className="font-medium flex-1 pr-2 text-sm">{o.label}</span>
                <div className="flex gap-3 text-xs shrink-0">
                  <span className={active ? "text-yellow-300 font-bold" : "text-yellow-400/60"}>{prob}%</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Pool do concurso para este evento */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-green-500/10 rounded-lg px-3 py-2">
              <p className="text-[10px] text-green-400/70 font-medium">POOL SIM</p>
              {poolSim > 0 ? (
                <>
                  <p className="text-sm font-bold text-green-400">{probSimPct}%</p>
                  <p className="text-[10px] text-green-400/60">Z$ {poolSim.toFixed(0)}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Vazio</p>
              )}
            </div>
            <div className="bg-red-500/10 rounded-lg px-3 py-2">
              <p className="text-[10px] text-red-400/70 font-medium">POOL NÃO</p>
              {poolNao > 0 ? (
                <>
                  <p className="text-sm font-bold text-red-400">{probNaoPct}%</p>
                  <p className="text-[10px] text-red-400/60">Z$ {poolNao.toFixed(0)}</p>
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
                        ? "bg-green-500 text-white ring-2 ring-green-500/50"
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
        </>
      )}

      {/* Input */}
      <div>
        <label className="text-xs text-yellow-300/60 mb-1.5 block">Valor em Z$ (mín. 1)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-400/60 text-sm">Z$</span>
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
              className="flex-1 py-1 text-xs bg-yellow-400/10 hover:bg-primary/90/20 text-yellow-400 rounded transition-colors disabled:opacity-30"
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
          {isMulti ? (
            selectedOutcome ? (
              <>
                <div className="flex justify-between">
                  <span className="text-yellow-300/60">Resultado</span>
                  <span className="text-yellow-300 font-semibold truncate max-w-[140px]">{selectedOutcome.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-300/60">Retorno estimado</span>
                  <span className="text-yellow-300 font-semibold">Z$ {multiReturn.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <p className="text-yellow-300/50">Selecione um resultado para ver o retorno estimado.</p>
            )
          ) : poolSim > 0 && poolNao > 0 ? (
            <>
              <div className="flex justify-between">
                <span className="text-yellow-300/60">Probabilidade de {side.toUpperCase()}</span>
                <span className="text-yellow-400 font-bold">{currentProbPct ? `${currentProbPct}%` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-yellow-300/60">Retorno estimado</span>
                <span className="text-yellow-300 font-semibold">Z$ {expectedReturn.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <p className="text-yellow-300/50">Você será o primeiro neste lado — probabilidades definidas conforme outros entram.</p>
          )}
          {!isMulti && (
            <div className="flex justify-between border-t border-yellow-400/10 pt-1">
              <span className="text-yellow-300/50">Lucro potencial</span>
              <span className="text-green-400 font-semibold">+Z$ {expectedProfit.toFixed(2)}</span>
            </div>
          )}
          <p className="text-yellow-300/40 text-[10px]">100% parimutuel — retorno proporcional ao pool.</p>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-yellow-400 text-xs">{success}</p>}

      <button
        onClick={handleBet}
        disabled={loading || !amountNum || insufficientBalance}
        className="w-full py-3 rounded-lg font-bold text-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin mx-auto" />
        ) : insufficientBalance && amountNum > 0 ? (
          "Z$ insuficiente"
        ) : isMulti ? (
          `Palpitar${selectedOutcome ? ` · ${selectedOutcome.label.slice(0, 18)}` : ""}${amountNum > 0 ? ` · Z$ ${amountNum}` : ""}`
        ) : (
          `Palpite ${side.toUpperCase()}${amountNum > 0 ? ` · Z$ ${amountNum}` : ""}`
        )}
      </button>
    </div>
  );
}
