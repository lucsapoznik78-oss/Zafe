"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function ContestButton({ eventId, canContest }: { eventId: string; canContest: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!canContest || done) return null;

  async function handleContest() {
    setError("");
    if (reason.length < 10) { setError("Explique o motivo (mínimo 10 caracteres)"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/comunidade/${eventId}/contestar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro"); return; }
      setDone(true);
      router.refresh();
    } catch { setError("Erro de rede"); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 transition-colors"
        >
          <AlertTriangle size={12} />
          Contestar resultado
        </button>
      ) : (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 space-y-2">
          <p className="text-xs text-orange-300">
            Taxa: Z$ 10 (devolvida se contestação aceita)
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explique por que o resultado está errado..."
            className="w-full bg-black border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500/50 min-h-[60px]"
            maxLength={500}
          />
          <div className="flex gap-2">
            <button
              onClick={handleContest}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-orange-500 text-black font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Enviar contestação
            </button>
            <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-muted text-white text-xs">
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-nao">{error}</p>}
        </div>
      )}
    </div>
  );
}
