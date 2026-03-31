"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  betId: string;
  side: "sim" | "nao";
  amount: number;
}

export default function ExitBetCard({ betId, side, amount }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const devolucao = parseFloat((amount * 0.96).toFixed(2));
  const taxa      = parseFloat((amount * 0.04).toFixed(2));

  async function handleExit() {
    setLoading(true);
    const res = await fetch(`/api/apostas/${betId}/sair`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-center text-sm text-muted-foreground">
        Saída confirmada. {formatCurrency(devolucao)} devolvidos ao seu saldo.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Sua posição</h3>
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${side === "sim" ? "bg-sim/20 text-sim" : "bg-nao/20 text-nao"}`}>
          {side.toUpperCase()}
        </span>
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Apostado</span>
        <span className="text-white font-semibold">{formatCurrency(amount)}</span>
      </div>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="w-full flex items-center justify-center gap-2 py-2 border border-border text-muted-foreground text-sm rounded-lg hover:border-nao/40 hover:text-nao transition-colors"
        >
          <LogOut size={13} />
          Sair desta aposta
        </button>
      ) : (
        <div className="space-y-2">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1.5 text-xs">
            <p className="flex items-center gap-1.5 text-yellow-400 font-semibold">
              <AlertTriangle size={11} />
              Confirmar saída antecipada?
            </p>
            <div className="flex justify-between text-muted-foreground">
              <span>Você recebe de volta</span>
              <span className="text-sim font-semibold">{formatCurrency(devolucao)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de saída (4%)</span>
              <span className="text-nao">{formatCurrency(taxa)}</span>
            </div>
            <p className="text-muted-foreground/60 pt-0.5 border-t border-border">
              Você abre mão de qualquer ganho futuro neste mercado.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 py-2 bg-muted text-muted-foreground text-sm rounded-lg hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleExit}
              disabled={loading}
              className="flex-1 py-2 bg-nao/20 text-nao text-sm font-semibold rounded-lg hover:bg-nao/30 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={13} className="animate-spin mx-auto" /> : "Confirmar saída"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
