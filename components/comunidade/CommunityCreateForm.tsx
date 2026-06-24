"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { CATEGORIES } from "@/lib/utils";

export default function CommunityCreateForm({ creatorScore }: { creatorScore: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("esportes");
  const [closesAt, setClosesAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim() || !description.trim() || !closesAt) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/comunidade/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          closes_at: new Date(closesAt).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao criar");
        return;
      }
      router.push(`/comunidade/${data.event_id}`);
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  // Min date: 1h from now
  const minDate = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  const maxDate = new Date(Date.now() + 90 * 24 * 3600000).toISOString().slice(0, 16);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-lg p-3">
        <Star size={14} className={creatorScore >= 90 ? "text-yellow-400" : ""} />
        Sua nota de criador: <span className="text-white font-bold">{creatorScore}</span>
      </div>

      <div>
        <label className="text-sm text-white font-medium mb-1 block">
          Pergunta <span className="text-muted-foreground font-normal">(SIM ou NÃO)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Ex: Vai chover amanhã em SP?"
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        <p className="text-[10px] text-muted-foreground mt-1">{title.length}/120</p>
      </div>

      <div>
        <label className="text-sm text-white font-medium mb-1 block">
          Critério de resolução
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Descreva como o resultado será determinado..."
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        <p className="text-[10px] text-muted-foreground mt-1">{description.length}/500</p>
      </div>

      <div>
        <label className="text-sm text-white font-medium mb-1 block">Categoria</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm text-white font-medium mb-1 block">Prazo de fechamento</label>
        <input
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          min={minDate}
          max={maxDate}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Você terá 72h após o fechamento para resolver o evento.
        </p>
      </div>

      {error && <p className="text-sm text-nao">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg bg-primary text-black font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Criar evento
      </button>

      <p className="text-[10px] text-muted-foreground text-center">
        Ao criar, você se compromete a resolver o evento honestamente.
        Resoluções incorretas afetam sua nota de criador.
      </p>
    </form>
  );
}
