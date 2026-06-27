"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const COOLOFF_OPCOES = [
  { days: 1, label: "24 horas" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

// Controles de jogo responsável: pausa temporária (cool-off) e autoexclusão.
// Ambas só ESTENDEM o prazo no servidor — não há como encurtar pelo client.
export default function ResponsibleGamingControls() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function call(action: string, days?: number) {
    setLoading(days ? `cooloff-${days}` : action);
    setError(null);
    try {
      const res = await fetch("/api/jogo-responsavel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível concluir agora.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de rede — tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Fazer uma pausa</p>
          <p className="text-xs text-muted-foreground">
            Bloqueia o acesso à plataforma pelo período escolhido. Você poderá voltar
            automaticamente quando o prazo terminar.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {COOLOFF_OPCOES.map((o) => (
            <button
              key={o.days}
              disabled={!!loading}
              onClick={() => call("cooloff", o.days)}
              className="py-2 px-3 rounded-lg border border-border bg-input text-sm font-medium text-white hover:border-violet-400/50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === `cooloff-${o.days}` && <Loader2 size={13} className="animate-spin" />}
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-red-300">Autoexclusão</p>
          <p className="text-xs text-muted-foreground">
            Bloqueia sua conta por tempo prolongado. Para reverter antes do prazo, será
            necessário falar com o suporte. Use se sentir que precisa parar.
          </p>
        </div>
        {!confirming ? (
          <button
            disabled={!!loading}
            onClick={() => setConfirming(true)}
            className="py-2 px-3 rounded-lg border border-red-500/40 bg-red-500/10 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            Quero me autoexcluir
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              disabled={!!loading}
              onClick={() => call("self_exclude")}
              className="flex-1 py-2 px-3 rounded-lg border border-red-500/50 bg-red-500/20 text-sm font-bold text-red-200 hover:bg-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === "self_exclude" && <Loader2 size={13} className="animate-spin" />}
              Confirmar autoexclusão
            </button>
            <button
              disabled={!!loading}
              onClick={() => setConfirming(false)}
              className="py-2 px-3 rounded-lg border border-border bg-input text-sm font-medium text-white hover:border-border/80 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
