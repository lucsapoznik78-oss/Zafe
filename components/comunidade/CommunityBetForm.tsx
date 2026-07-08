"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { playConfirm } from "@/lib/sound";
import { Loader2, Wallet } from "lucide-react";

interface CommunityBetFormProps {
  eventId: string;
  totalSim: number;
  totalNao: number;
  isClosed: boolean;
  userBalance?: number;
}

export default function CommunityBetForm({ eventId, totalSim, totalNao, isClosed, userBalance = 0 }: CommunityBetFormProps) {
  const router = useRouter();
  const [side, setSide] = useState<"sim" | "nao">("sim");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const amountNum = parseFloat(amount) || 0;
  const totalPool = totalSim + totalNao;
  const sidePool = side === "sim" ? totalSim : totalNao;
  // Payout parimutuel real: o próprio palpite entra no pool antes do rateio,
  // então o denominador é (pool do lado + valor), não o pool atual. Sem isso,
  // ser o primeiro de um lado (sidePool=0) estourava a cotação para 999x.
  const currentOdds = amountNum > 0 && sidePool + amountNum > 0
    ? (totalPool + amountNum) / (sidePool + amountNum)
    : 0;
  const expectedReturn = amountNum * currentOdds;

  async function handleBet() {
    setError("");
    setSuccess("");
    if (amountNum < 1) { setError("Valor mínimo: Z$ 1,00"); return; }
    if (amountNum > userBalance) { setError(`Saldo insuficiente. Você tem ${formatCurrency(userBalance)}.`); return; }

    setLoading(true);
    try {
      const res = await fetch(`/api/comunidade/${eventId}/palpitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, amount: amountNum }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro"); return; }
      setSuccess("Palpite registrado!");
      playConfirm();
      setAmount("");
      router.refresh();
    } catch { setError("Erro de rede"); } finally { setLoading(false); }
  }

  if (isClosed) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center text-muted-foreground text-sm">
        Este evento não aceita mais palpites
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white">Fazer palpite</h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide("sim")}
          className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
            side === "sim" ? "bg-sim text-black" : "bg-sim/10 text-sim hover:bg-sim/20"
          }`}
        >
          SIM
        </button>
        <button
          onClick={() => setSide("nao")}
          className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
            side === "nao" ? "bg-nao text-white" : "bg-nao/10 text-nao hover:bg-nao/20"
          }`}
        >
          NÃO
        </button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Valor (Z$)</label>
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full bg-black border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
        />
      </div>

      {amountNum > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Cotação estimada</span>
            <span className="text-white">{currentOdds.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between">
            <span>Retorno estimado</span>
            <span className="text-primary">{formatCurrency(expectedReturn)}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wallet size={12} />
        <span>Saldo: {formatCurrency(userBalance)}</span>
      </div>

      {error && <p className="text-xs text-nao">{error}</p>}
      {success && <p className="text-xs text-sim">{success}</p>}

      <button
        onClick={handleBet}
        disabled={loading || amountNum < 1}
        className="w-full py-2.5 rounded-lg bg-primary text-black font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Palpitar {side.toUpperCase()}
      </button>
    </div>
  );
}
