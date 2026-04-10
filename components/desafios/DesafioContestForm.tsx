"use client";

import { useState } from "react";
import { Loader2, Flag } from "lucide-react";

interface Props {
  desafioId: string;
  contestationDeadlineAt: string;
}

export default function DesafioContestForm({ desafioId, contestationDeadlineAt }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const deadline = new Date(contestationDeadlineAt);
  const hoursLeft = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60)));

  async function handleContest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch(`/api/desafios/${desafioId}/contestar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao contestar");
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="bg-nao/10 border border-nao/30 rounded-xl p-4 text-center">
        <p className="text-sm font-semibold text-nao">Contestação enviada</p>
        <p className="text-xs text-muted-foreground mt-1">A Zafe vai revisar e resolver.</p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag size={14} className="text-yellow-400" />
          <p className="text-sm font-semibold text-yellow-400">Resultado em contestação</p>
        </div>
        <span className="text-xs text-yellow-300/70">{hoursLeft}h restantes</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Prazo: {deadline.toLocaleString("pt-BR")}. Se não houver contestações, o resultado será confirmado automaticamente.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2 border border-nao/50 text-nao rounded-lg text-xs font-medium hover:bg-nao/10 transition-colors"
        >
          Contestar este resultado
        </button>
      ) : (
        <form onSubmit={handleContest} className="space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Explique por que o resultado está errado. Inclua evidências ou links se possível."
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none resize-none"
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 py-2 border border-border text-muted-foreground rounded-lg text-xs hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading || reason.trim().length < 10}
              className="flex-1 py-2 bg-nao text-white rounded-lg text-xs font-bold hover:bg-nao/90 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Enviar contestação"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
