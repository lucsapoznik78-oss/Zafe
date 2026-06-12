"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";

interface Props {
  buyIn: number;
}

// CTA de inscrição: confirma o débito de Z$ 400 da carteira principal
// antes de chamar POST /api/copa/participar.
export default function JoinCard({ buyIn }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/copa/participar", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao confirmar inscrição");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de rede — tente novamente");
    } finally {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-1.5">
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400 text-black font-bold text-sm rounded-lg hover:bg-yellow-400/90 transition-colors"
        >
          <Ticket size={15} /> Participar por Z$ {buyIn.toLocaleString("pt-BR")}
        </button>
        {error && <p className="text-xs text-nao">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 max-w-sm">
      <p className="text-sm text-white font-semibold">Confirmar inscrição?</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Serão debitados <span className="text-white font-mono">Z$ {buyIn.toLocaleString("pt-BR")}</span> da
        sua carteira. O valor vai direto para o pote da premiação — o 1º colocado do ranking final leva tudo.
        A inscrição não pode ser desfeita.
      </p>
      {error && <p className="text-xs text-nao">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={join}
          disabled={loading}
          className="flex-1 py-2 bg-yellow-400 text-black font-bold text-sm rounded-lg hover:bg-yellow-400/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Confirmar e participar"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={loading}
          className="px-3 py-2 bg-muted text-muted-foreground text-sm rounded-lg hover:text-white transition-colors"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
