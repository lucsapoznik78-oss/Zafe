"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/utils";
import { Loader2, AlertTriangle } from "lucide-react";

// Keywords that indicate a subjective/unverifiable event
const SUBJECTIVE_PATTERNS = [
  /\bescala[rá]?\b/i, /\bsignificativ/i, /\bmuito\b/i, /\bgrande[s]?\b/i,
  /\bmelhor[a]?\b/i, /\bpior[a]?\b/i, /\balta[s]?\b/i, /\bbaixa[s]?\b/i,
  /\bcresc[e]?\b/i, /\bserá bom\b/i, /\bserá ruim\b/i, /\bsuficiente\b/i,
  /\bconsiderável\b/i, /\bsubstancial\b/i, /\bexpressiv/i, /\brápido\b/i,
  /\blento\b/i, /\bpopular\b/i, /\bimpopular\b/i,
];

function detectSubjectiveTitle(title: string): boolean {
  return SUBJECTIVE_PATTERNS.some((p) => p.test(title));
}

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

    // Se o usuário não especificou horário (00:00), expirar ao final do dia (23:59:59)
    const closesDate = new Date(form.closes_at);
    if (closesDate.getHours() === 0 && closesDate.getMinutes() === 0) {
      closesDate.setHours(23, 59, 59, 0);
    }

    setLoading(true);
    try {
      const res = await fetch("/api/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, closes_at: closesDate.toISOString() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar tópico");
      } else {
        router.push("/meus-topicos");
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
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="text-white font-semibold text-sm">Como criar um bom mercado</p>
        <p>✓ Use perguntas com resultado <strong className="text-white">binário e verificável</strong> (sim ou não, acima/abaixo de X)</p>
        <p>✓ Inclua <strong className="text-white">números, datas e fontes</strong> na descrição (ex: segundo o IBGE, acima de R$ 6,00)</p>
        <p>✗ Evite termos vagos: vai escalar, será grande, melhorar muito — o oráculo não consegue verificar</p>
      </div>
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
        {detectSubjectiveTitle(form.title) && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2.5 mt-1">
            <AlertTriangle size={13} className="text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-300 space-y-1">
              <p className="font-semibold">Evento pode ser subjetivo</p>
              <p className="text-yellow-400/80">O oráculo de IA só consegue verificar fatos objetivos e mensuráveis. Prefira perguntas com threshold numérico ou resultado binário claro.</p>
              <p className="text-yellow-400/70">✗ A inflação vai subir muito? — subjetivo</p>
              <p className="text-yellow-400/70">✓ O IPCA de abril 2026 vai superar 0,5%? — verificável</p>
            </div>
          </div>
        )}
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
