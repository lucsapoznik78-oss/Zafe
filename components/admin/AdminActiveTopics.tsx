"use client";

import { useState } from "react";
import { Pencil, Check, X, Loader2, Trash2 } from "lucide-react";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import { useRouter } from "next/navigation";

interface Topic {
  id: string;
  title: string;
  category: string;
  closes_at: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminActiveTopics({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function limparDuplicados() {
    setCleaning(true);
    setCleanResult("");
    const res = await fetch("/api/admin/limpar-duplicados", { method: "POST" });
    const data = await res.json();
    setCleanResult(res.ok ? `✅ ${data.removed} duplicado(s) removido(s)` : `❌ ${data.error}`);
    setCleaning(false);
    router.refresh();
  }

  async function deleteTopic(topicId: string) {
    if (!confirm("Deletar este mercado? Só funciona se não houver apostas.")) return;
    setDeleting(topicId);
    const res = await fetch("/api/admin/deletar-topico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId }),
    });
    const data = await res.json();
    if (!res.ok) alert(data.error);
    setDeleting(null);
    router.refresh();
  }

  async function save(topicId: string) {
    if (!value) return;
    setLoading(true);
    const closesDate = new Date(value);
    if (closesDate.getHours() === 0 && closesDate.getMinutes() === 0) {
      closesDate.setHours(23, 59, 59, 0);
    }
    const res = await fetch("/api/admin/atualizar-expiracao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: topicId, closes_at: closesDate.toISOString() }),
    });
    if (res.ok) {
      setSaved((s) => ({ ...s, [topicId]: closesDate.toISOString() }));
    }
    setEditing(null);
    setLoading(false);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          Mercados Ativos — Editar Prazo
          <span className="ml-2 px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs">{topics.length}</span>
        </h3>
        <div className="flex items-center gap-2">
          {cleanResult && <span className="text-xs text-primary">{cleanResult}</span>}
          <button
            onClick={limparDuplicados}
            disabled={cleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-nao/10 text-nao rounded-lg hover:bg-nao/20 transition-colors disabled:opacity-50"
          >
            {cleaning ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Limpar duplicados
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {topics.map((topic) => {
          const closesAt = saved[topic.id] ?? topic.closes_at;
          const isEditing = editing === topic.id;
          return (
            <div key={topic.id} className="border border-border rounded-lg p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CategoryBadge category={topic.category as any} className="mb-1" />
                  <p className="text-xs font-medium text-white leading-snug line-clamp-2">{topic.title}</p>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditing(topic.id); setValue(toLocalInput(closesAt)); }}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => deleteTopic(topic.id)}
                      disabled={deleting === topic.id}
                      className="p-1.5 text-muted-foreground hover:text-nao transition-colors disabled:opacity-50"
                    >
                      {deleting === topic.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="datetime-local"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary/50"
                  />
                  <button
                    onClick={() => save(topic.id)}
                    disabled={loading}
                    className="p-1.5 bg-sim/20 text-sim rounded hover:bg-sim/30 transition-colors"
                  >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="p-1.5 bg-nao/20 text-nao rounded hover:bg-nao/30 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Encerra: <span className={saved[topic.id] ? "text-primary" : ""}>{fmtDate(closesAt)}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
