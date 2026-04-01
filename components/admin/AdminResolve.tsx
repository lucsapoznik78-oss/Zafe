"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Resolucao {
  id: string;
  resultado_final: string;
  oracle_usado: string;
  resolvido_por: string;
  created_at: string;
}

interface Topic {
  id: string;
  title: string;
  category: string;
  resolucoes: Resolucao[];
}

export default function AdminResolve({ topics }: { topics: Topic[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function resolve(topicId: string, resolution: "sim" | "nao" | "cancelled") {
    setLoading(topicId + resolution);
    await fetch("/api/admin/resolver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId, resolution }),
    });
    setLoading(null);
    window.location.reload();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
        <AlertTriangle size={14} className="text-yellow-400" />
        Contradições Oracle — Revisão Manual
        {topics.length > 0 && (
          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">{topics.length}</span>
        )}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        A API externa retornou um resultado, mas a validação de IA discordou. O sistema não pode decidir sozinho — revise e vote.
      </p>

      {topics.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">
          Nenhuma contradição pendente — o sistema está resolvendo tudo automaticamente.
        </p>
      ) : (
        <div className="space-y-4">
          {topics.map((topic) => {
            const resolucao = topic.resolucoes?.[0];
            return (
              <div key={topic.id} className="border border-yellow-500/30 rounded-lg p-4 space-y-3 bg-yellow-500/5">
                <div>
                  <CategoryBadge category={topic.category as any} className="mb-1.5" />
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold text-white flex-1">{topic.title}</p>
                    <Link href={`/topicos/${topic.id}`} target="_blank" className="text-muted-foreground hover:text-white shrink-0">
                      <ExternalLink size={13} />
                    </Link>
                  </div>
                </div>

                {resolucao && (
                  <div className="bg-card border border-border rounded-lg p-3 space-y-1.5 text-xs">
                    <p className="text-yellow-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle size={11} />
                      Motivo da contradição
                    </p>
                    <p className="text-muted-foreground">
                      A API <span className="text-white font-mono">{resolucao.oracle_usado}</span> retornou um resultado definitivo,
                      mas a validação cruzada com IA não confirmou. A plataforma pausou a resolução aguardando revisão humana.
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Sinalizado{" "}
                      {formatDistanceToNow(new Date(resolucao.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(topic.id, "sim")}
                    disabled={!!loading}
                    className="flex-1 py-2 bg-sim text-black font-bold text-sm rounded-lg hover:bg-sim/90 disabled:opacity-50 transition-colors"
                  >
                    {loading === topic.id + "sim" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "SIM venceu"}
                  </button>
                  <button
                    onClick={() => resolve(topic.id, "nao")}
                    disabled={!!loading}
                    className="flex-1 py-2 bg-nao text-black font-bold text-sm rounded-lg hover:bg-nao/90 disabled:opacity-50 transition-colors"
                  >
                    {loading === topic.id + "nao" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "NÃO venceu"}
                  </button>
                  <button
                    onClick={() => resolve(topic.id, "cancelled")}
                    disabled={!!loading}
                    className="px-3 py-2 bg-muted text-muted-foreground text-sm rounded-lg hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
