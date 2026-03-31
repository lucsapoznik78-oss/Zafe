"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["politica","esportes","cultura","economia","tecnologia","entretenimento","outros"];

interface Topic {
  id: string;
  title: string;
  description: string | null;
  category: string;
  closes_at: string;
}

export default function EditTopicForm({ topic }: { topic: Topic }) {
  const router = useRouter();
  const [title, setTitle] = useState(topic.title);
  const [description, setDescription] = useState(topic.description ?? "");
  const [category, setCategory] = useState(topic.category);
  // Convert UTC timestamp to local datetime-local format
  const [closesAt, setClosesAt] = useState(
    topic.closes_at ? new Date(topic.closes_at).toISOString().slice(0, 16) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/topicos/${topic.id}/editar`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category, closes_at: closesAt }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Erro ao salvar");
      setLoading(false);
      return;
    }
    router.push("/meus-topicos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground">Pergunta da aposta</label>
          <input
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
          <textarea
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm resize-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Categoria</label>
            <select
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Data do evento</label>
            <input
              type="datetime-local"
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 bg-muted text-white font-semibold rounded-xl hover:bg-muted/80 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 bg-primary text-black font-bold rounded-xl disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}
