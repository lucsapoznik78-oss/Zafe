"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface Desafio {
  id: string;
  title: string;
  status: string;
  resolution: string | null;
  proof_url: string | null;
  proof_type: string | null;
  proof_notes: string | null;
  closes_at: string;
  proof_deadline_at: string | null;
  creator: { username: string; full_name: string } | null;
  contestations: { reason: string; contestant: { username: string } | null }[];
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  resolving:          { label: "Oracle rodando",    cls: "bg-yellow-500/20 text-yellow-400" },
  awaiting_proof:     { label: "Aguardando prova",  cls: "bg-yellow-500/20 text-yellow-400" },
  proof_submitted:    { label: "Prova enviada",     cls: "bg-blue-500/20 text-blue-400" },
  under_contestation: { label: "Em contestação",    cls: "bg-orange-500/20 text-orange-400" },
  admin_review:       { label: "Revisão admin",     cls: "bg-purple-500/20 text-purple-400" },
};

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
      <h2 className="text-lg font-bold text-white mb-3">Desafios Pendentes ({pending.length})</h2>
      <div className="space-y-4">
        {pending.map((d) => {
          const statusInfo = STATUS_LABEL[d.status] ?? { label: d.status, cls: "bg-muted text-muted-foreground" };
          return (
            <div key={d.id} className="bg-card border border-purple-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white font-semibold text-sm">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Criador: @{d.creator?.username ?? d.creator?.full_name ?? "?"} ·
                    Encerrou: {new Date(d.closes_at).toLocaleString("pt-BR")}
                    {d.resolution && <> · Declarado: <span className="font-bold text-white">{d.resolution.toUpperCase()}</span></>}
                  </p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${statusInfo.cls}`}>{statusInfo.label}</span>
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

              {!d.proof_url && d.status === "awaiting_proof" && (
                <p className="text-xs text-yellow-400/70">
                  Prazo para prova: {d.proof_deadline_at ? new Date(d.proof_deadline_at).toLocaleString("pt-BR") : "indefinido"}
                </p>
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
          );
        })}
      </div>
    </div>
  );
}
