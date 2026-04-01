"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function CreateTopicForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "outros",
    closes_at: "",
    min_bet: "1",
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.title || !form.description || !form.closes_at) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }

    if (new Date(form.closes_at) <= new Date()) {
      setError("A data de encerramento deve ser no futuro");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/criar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao criar tópico");
    } else {
      router.push("/meus-topicos");
    }
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 16);

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-white">
          Pergunta <span className="text-nao">*</span>
        </label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={120}
          placeholder="Ex: O Brasil vai ganhar a Copa 2026?"
          className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        <p className="text-[10px] text-muted-foreground text-right">{form.title.length}/120</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-white">
          Descrição <span className="text-nao">*</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Descreva os critérios de resolução com clareza..."
          className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right">{form.description.length}/500</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white">Categoria</label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white">Investimento mínimo (Z$)</label>
          <input
            type="number"
            value={form.min_bet}
            onChange={(e) => set("min_bet", e.target.value)}
            min="1"
            step="0.50"
            className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-white">
          Prazo de resolução <span className="text-nao">*</span>
        </label>
        <input
          type="datetime-local"
          value={form.closes_at}
          onChange={(e) => set("closes_at", e.target.value)}
          min={minDateStr}
          className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
        />
      </div>

      <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground">
        <p>Após a criação, seu tópico ficará em fila de moderação e será publicado após aprovação de um administrador.</p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-primary text-black font-bold rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Enviar para Moderação"}
      </button>
    </form>
  );
}
