"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import { Check, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  closes_at: string;
  creator: { username: string; full_name: string };
}

export default function AdminQueue({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function action(topicId: string, approve: boolean) {
    setLoading(topicId);
    await fetch(approve ? "/api/admin/aprovar" : "/api/admin/rejeitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        Fila de Moderação
        {topics.length > 0 && (
          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">{topics.length}</span>
        )}
      </h3>
      {topics.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">Nenhum tópico aguardando aprovação</p>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <div key={topic.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <CategoryBadge category={topic.category as any} className="mb-1.5" />
                  <p className="text-sm font-semibold text-white">{topic.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topic.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>por <span className="text-white">{topic.creator?.full_name}</span></span>
                    <span>Prazo: {format(new Date(topic.closes_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => action(topic.id, true)}
                    disabled={loading === topic.id}
                    className="p-2 bg-sim/20 text-sim rounded-lg hover:bg-sim/30 transition-colors"
                  >
                    {loading === topic.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button
                    onClick={() => action(topic.id, false)}
                    disabled={loading === topic.id}
                    className="p-2 bg-nao/20 text-nao rounded-lg hover:bg-nao/30 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
