"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/utils";
import { Loader2, AlertTriangle } from "lucide-react";

export default function CreateDesafioForm() {
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

    if (!form.title.trim() || !form.description.trim() || !form.closes_at) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }
    if (new Date(form.closes_at) <= new Date()) {
      setError("A data de encerramento deve ser no futuro");
      return;
    }

    const closesDate = new Date(form.closes_at);
    if (closesDate.getHours() === 0 && closesDate.getMinutes() === 0) {
      closesDate.setHours(23, 59, 59, 0);
    }

    setLoading(true);
    try {
      const res = await fetch("/api/desafios/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, closes_at: closesDate.toISOString() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar desafio");
      } else {
        router.push(`/desafios/${data.id}`);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 16);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Aviso regras */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm">
          <AlertTriangle size={16} />
          Leia antes de criar
        </div>
        <ul className="text-xs text-yellow-300/80 space-y-1 list-disc list-inside">
          <li>Você <strong>não pode apostar</strong> no seu próprio desafio</li>
          <li>Você ganha <strong>6% do total apostado</strong> ao resolver</li>
          <li>Ao encerrar o prazo, você terá <strong>48h para enviar provas</strong> do resultado</li>
          <li>As provas serão avaliadas por IA — exija evidências claras nos critérios</li>
          <li>Se der prova falsa: <strong>perde a taxa e pode ser banido</strong></li>
        </ul>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white">
            Pergunta <span className="text-nao">*</span>
          </label>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={120}
            placeholder="Ex: Vou correr 5km antes de domingo?"
            className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <p className="text-[10px] text-muted-foreground text-right">{form.title.length}/120</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white">
            Critérios de resolução <span className="text-nao">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={800}
            rows={4}
            placeholder="Descreva exatamente como o resultado será comprovado. Ex: 'Vou postar print do app de corrida mostrando 5km em menos de 35 minutos, no sábado 12/04'."
            className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">{form.description.length}/800</p>
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
            <label className="text-sm font-medium text-white">Aposta mínima (Z$)</label>
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
            Prazo de encerramento <span className="text-nao">*</span>
          </label>
          <input
            type="datetime-local"
            value={form.closes_at}
            onChange={(e) => set("closes_at", e.target.value)}
            min={minDateStr}
            className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
          />
          <p className="text-[10px] text-muted-foreground">
            Após esse prazo, você terá 48h para enviar as provas.
          </p>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-black font-bold rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Criar Desafio"}
        </button>
      </div>
    </form>
  );
}
