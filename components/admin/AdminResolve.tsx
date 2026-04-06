"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ExternalLink, Clock } from "lucide-react";
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

interface TopicRevisao {
  id: string;
  title: string;
  category: string;
  resolucoes: Resolucao[];
}

interface TopicResolving {
  id: string;
  title: string;
  category: string;
  closes_at: string;
  oracle_retry_count: number | null;
}

interface Props {
  topics: TopicRevisao[];
  allResolving: TopicResolving[];
}

export default function AdminResolve({ topics, allResolving }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function resolve(topicId: string, resolution: "sim" | "nao" | "cancelled") {
    setLoading(topicId + resolution);
    const res = await fetch("/api/admin/resolver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId, resolution }),
    });
    setLoading(null);
    if (res.ok) {
      setDone(d => new Set([...d, topicId]));
      setTimeout(() => window.location.reload(), 800);
    }
  }

  // Filtra resolving que ainda não foram resolvidos manualmente nesta sessão
  const pendingResolving = allResolving.filter(t => !done.has(t.id));

  const hasSinalizado = topics.length > 0;
  const hasPending = pendingResolving.length > 0;

  if (!hasSinalizado && !hasPending) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          Mercados Aguardando Resolução
        </h3>
        <p className="text-muted-foreground text-sm text-center py-6">
          Nenhum mercado pendente — tudo resolvido automaticamente.
        </p>
      </div>
    );
  }

  function ResolveBtns({ topicId }: { topicId: string }) {
    if (done.has(topicId)) return <p className="text-xs text-sim font-semibold">✅ Resolvido</p>;
    return (
      <div className="flex gap-2">
        <button onClick={() => resolve(topicId, "sim")} disabled={!!loading}
          className="flex-1 py-2 bg-sim text-black font-bold text-sm rounded-lg hover:bg-sim/90 disabled:opacity-50 transition-colors">
          {loading === topicId + "sim" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "SIM venceu"}
        </button>
        <button onClick={() => resolve(topicId, "nao")} disabled={!!loading}
          className="flex-1 py-2 bg-nao text-black font-bold text-sm rounded-lg hover:bg-nao/90 disabled:opacity-50 transition-colors">
          {loading === topicId + "nao" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "NÃO venceu"}
        </button>
        <button onClick={() => resolve(topicId, "cancelled")} disabled={!!loading}
          className="px-3 py-2 bg-muted text-muted-foreground text-sm rounded-lg hover:text-white transition-colors">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Todos resolving pendentes */}
      {hasPending && (
        <div className="bg-card border border-yellow-500/30 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Clock size={14} className="text-yellow-400" />
            Mercados Aguardando Resolução
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">{pendingResolving.length}</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Oracle está processando. Se não resolver automaticamente, resolva manualmente abaixo.
          </p>
          <div className="space-y-4">
            {pendingResolving.map((topic) => (
              <div key={topic.id} className="border border-border rounded-lg p-4 space-y-3">
                <div>
                  <CategoryBadge category={topic.category as any} className="mb-1.5" />
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold text-white flex-1">{topic.title}</p>
                    <Link href={`/topicos/${topic.id}`} target="_blank" className="text-muted-foreground hover:text-white shrink-0">
                      <ExternalLink size={13} />
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Encerrou: {new Date(topic.closes_at).toLocaleString("pt-BR")}
                    {(topic.oracle_retry_count ?? 0) > 0 && (
                      <span className="ml-2 text-yellow-400">· Oracle tentou {topic.oracle_retry_count}x</span>
                    )}
                  </p>
                </div>
                <ResolveBtns topicId={topic.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contradições oracle */}
      {hasSinalizado && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-400" />
            Contradições Oracle — Revisão Manual
            <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">{topics.length}</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            API externa e IA discordaram. Revise e decida.
          </p>
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
                    <div className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground">
                      API <span className="text-white font-mono">{resolucao.oracle_usado}</span> retornou resultado mas IA não confirmou ·{" "}
                      {formatDistanceToNow(new Date(resolucao.created_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  )}
                  <ResolveBtns topicId={topic.id} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
