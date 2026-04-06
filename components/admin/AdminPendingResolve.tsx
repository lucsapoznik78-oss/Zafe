"use client";

import { useState } from "react";
import { Loader2, ExternalLink, Clock } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";

interface Topic {
  id: string;
  title: string;
  category: string;
  status: string;
  closes_at: string;
  oracle_retry_count: number | null;
}

export default function AdminPendingResolve({ topics }: { topics: Topic[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  async function resolve(topicId: string, resolution: "sim" | "nao" | "cancelled") {
    setLoading(topicId + resolution);

    // Se o tópico ainda está active (expirado), primeiro muda para resolving
    const topic = topics.find(t => t.id === topicId);
    if (topic?.status === "active") {
      await fetch("/api/cron/fechar-mercados", { method: "POST" });
    }

    const res = await fetch("/api/admin/resolver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId, resolution }),
    });

    const data = await res.json();
    setResults(r => ({ ...r, [topicId]: res.ok ? `✅ ${resolution.toUpperCase()} pago` : `❌ ${data.error}` }));
    setLoading(null);

    if (res.ok) setTimeout(() => window.location.reload(), 1000);
  }

  if (topics.length === 0) return null;

  return (
    <div className="bg-card border border-yellow-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={14} className="text-yellow-400" />
        <h3 className="text-sm font-semibold text-white">
          Mercados Aguardando Resolução Manual
          <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">{topics.length}</span>
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Prazo encerrado e o oracle não conseguiu decidir automaticamente. Pesquise o resultado e resolva manualmente.
      </p>

      <div className="space-y-4">
        {topics.map((topic) => (
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
                {topic.oracle_retry_count != null && topic.oracle_retry_count > 0 && (
                  <span className="ml-2 text-yellow-400">· Oracle tentou {topic.oracle_retry_count}x sem resultado</span>
                )}
              </p>
            </div>

            {results[topic.id] ? (
              <p className="text-sm font-semibold text-primary">{results[topic.id]}</p>
            ) : (
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
