"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";

export default function ResolveForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<"sim" | "nao" | null>(null);

  async function handleResolve(resolution: "sim" | "nao") {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/comunidade/${eventId}/resolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro"); return; }
      router.refresh();
    } catch { setError("Erro de rede"); } finally { setLoading(false); setConfirming(null); }
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle size={16} className="text-yellow-400" />
        <h3 className="text-sm font-semibold text-yellow-400">Resolva seu evento</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Qual foi o resultado? Esta ação é irreversível.
      </p>

      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm text-white">
            Confirmar resultado: <span className="font-bold">{confirming.toUpperCase()}</span>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleResolve(confirming)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-primary text-black font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Confirmar
            </button>
            <button
              onClick={() => setConfirming(null)}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-muted text-white text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setConfirming("sim")}
            className="py-2.5 rounded-lg bg-sim text-black font-bold text-sm hover:bg-sim/90"
          >
            Resultado: SIM
          </button>
          <button
            onClick={() => setConfirming("nao")}
            className="py-2.5 rounded-lg bg-nao text-white font-bold text-sm hover:bg-nao/90"
          >
            Resultado: NÃO
          </button>
        </div>
      )}

      {error && <p className="text-xs text-nao">{error}</p>}
    </div>
  );
}
