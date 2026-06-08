"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export default function DeleteEventButton({ eventId, hasBets }: { eventId: string; hasBets: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/comunidade/${eventId}/apagar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro"); setLoading(false); return; }
      router.push("/comunidade");
      router.refresh();
    } catch { setError("Erro de rede"); setLoading(false); }
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-xs text-nao hover:text-nao/80 transition-colors"
        >
          <Trash2 size={12} />
          Apagar evento
        </button>
      ) : (
        <div className="bg-nao/10 border border-nao/30 rounded-xl p-3 space-y-2">
          <p className="text-xs text-nao/90">
            {hasBets
              ? "Apagar o evento? Os palpites feitos até agora serão reembolsados."
              : "Tem certeza que deseja apagar este evento? Esta ação é definitiva."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-nao text-white font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Apagar
            </button>
            <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-muted text-white text-xs">
              Voltar
            </button>
          </div>
          {error && <p className="text-xs text-nao">{error}</p>}
        </div>
      )}
    </div>
  );
}
