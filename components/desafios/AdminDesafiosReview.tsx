"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Desafio {
  id: string;
  title: string;
  resolution: string;
  proof_url: string;
  proof_type: string;
  proof_notes: string;
  creator: { username: string; full_name: string } | null;
  contestations: { reason: string; contestant: { username: string } | null }[];
}

interface Props {
  desafios: Desafio[];
}

export default function AdminDesafiosReview({ desafios }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function resolve(desafioId: string, resolution: "sim" | "nao" | "refund") {
    setLoading(desafioId);
    const res = await fetch(`/api/admin/desafios/${desafioId}/resolver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    setLoading(null);
    if (res.ok) {
      setDone((d) => new Set([...d, desafioId]));
    } else {
      const data = await res.json();
      alert(data.error ?? "Erro");
    }
  }

  const pending = desafios.filter((d) => !done.has(d.id));
  if (pending.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-3">Desafios em Revisão ({pending.length})</h2>
      <div className="space-y-4">
        {pending.map((d) => (
          <div key={d.id} className="bg-card border border-purple-500/30 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-white font-semibold text-sm">{d.title}</p>
              <p className="text-xs text-muted-foreground">
                Criador: @{d.creator?.username ?? d.creator?.full_name ?? "?"} ·
                Resultado declarado: <span className="font-bold text-white">{d.resolution?.toUpperCase()}</span>
              </p>
            </div>

            {/* Prova */}
            {d.proof_url && (
              <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-white">Prova enviada ({d.proof_type})</p>
                <a href={d.proof_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline break-all">
                  {d.proof_url}
                </a>
                {d.proof_notes && <p className="text-xs text-muted-foreground italic">{d.proof_notes}</p>}
              </div>
            )}

            {/* Contestações */}
            {d.contestations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-nao">{d.contestations.length} contestação(ões)</p>
                {d.contestations.map((c, i) => (
                  <div key={i} className="bg-nao/10 rounded p-2">
                    <p className="text-xs text-white">@{c.contestant?.username ?? "?"}</p>
                    <p className="text-xs text-muted-foreground">{c.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => resolve(d.id, "sim")} disabled={loading === d.id}
                className="px-3 py-1.5 bg-sim/20 text-sim border border-sim/40 rounded text-xs font-bold hover:bg-sim/30 disabled:opacity-50">
                {loading === d.id ? <Loader2 size={12} className="animate-spin" /> : "Confirmar SIM"}
              </button>
              <button onClick={() => resolve(d.id, "nao")} disabled={loading === d.id}
                className="px-3 py-1.5 bg-nao/20 text-nao border border-nao/40 rounded text-xs font-bold hover:bg-nao/30 disabled:opacity-50">
                Confirmar NÃO
              </button>
              <button onClick={() => resolve(d.id, "refund")} disabled={loading === d.id}
                className="px-3 py-1.5 bg-muted text-muted-foreground rounded text-xs font-bold hover:bg-muted/80 disabled:opacity-50">
                Reembolsar todos
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
