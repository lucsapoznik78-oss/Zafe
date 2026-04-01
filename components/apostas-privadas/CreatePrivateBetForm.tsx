"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["politica","esportes","cultura","economia","tecnologia","entretenimento","outros"];

interface FoundUser { id: string; username: string }

export default function CreatePrivateBetForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("outros");
  const [minBet, setMinBet] = useState("10");
  const [closesAt, setClosesAt] = useState("");
  const [adversariosInput, setAdversariosInput] = useState("");
  const [judgesInput, setJudgesInput] = useState("");
  const [adversarios, setAdversarios] = useState<FoundUser[]>([]);
  const [judges, setJudges] = useState<FoundUser[]>([]);
  const [searchResult, setSearchResult] = useState<FoundUser | null>(null);
  const [searchType, setSearchType] = useState<"adversario" | "juiz">("adversario");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function buscarUsuario(username: string, tipo: "adversario" | "juiz") {
    if (!username.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles").select("id, username")
      .eq("username", username.trim()).single();
    if (!data) { setError(`Usuário "${username}" não encontrado`); return; }
    if (data.id === userId) { setError("Você não pode adicionar a si mesmo"); return; }
    setSearchResult(data);
    setSearchType(tipo);
    setError("");
  }

  function adicionarUsuario(u: FoundUser, tipo: "adversario" | "juiz") {
    const allIds = [...adversarios, ...judges].map(x => x.id);
    if (allIds.includes(u.id)) { setError("Usuário já adicionado"); return; }

    if (tipo === "adversario") {
      setAdversarios(prev => [...prev, u]);
      setAdversariosInput("");
    } else {
      if (judges.length >= 7) { setError("Máximo de 7 juízes"); return; }
      setJudges(prev => [...prev, u]);
      setJudgesInput("");
    }
    setSearchResult(null);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (adversarios.length < 1) { setError("Adicione pelo menos 1 adversário"); return; }
    if (judges.length < 3) { setError("Adicione pelo menos 3 juízes"); return; }
    if (!title || !closesAt) { setError("Preencha todos os campos"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/apostas-privadas/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, category,
          min_bet: parseFloat(minBet),
          closes_at: closesAt,
          adversario_ids: adversarios.map(a => a.id),
          judge_ids: judges.map(j => j.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao criar aposta"); return; }
      router.push(`/apostas-privadas/${data.topic_id}`);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-white">Evento</p>
        <div>
          <label className="text-xs text-muted-foreground">Pergunta da aposta</label>
          <input
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Ex: Palmeiras vai ganhar o Brasileirão 2026?"
            value={title} onChange={e => setTitle(e.target.value)} required maxLength={120}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
          <textarea
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm resize-none"
            rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={500}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Categoria</label>
            <select
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
              value={category} onChange={e => setCategory(e.target.value)}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Investimento mínimo (Z$)</label>
            <input
              type="number" min="1" step="1"
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
              value={minBet} onChange={e => setMinBet(e.target.value)} required
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Data do evento</label>
          <input
            type="datetime-local"
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
            value={closesAt} onChange={e => setClosesAt(e.target.value)} required
          />
        </div>
      </div>

      {/* Adversários */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-white">Adversários <span className="text-muted-foreground font-normal">(Lado B — apostam NÃO)</span></p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Username do adversário"
            value={adversariosInput} onChange={e => setAdversariosInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), buscarUsuario(adversariosInput, "adversario"))}
          />
          <button type="button" onClick={() => buscarUsuario(adversariosInput, "adversario")}
            className="px-3 py-2 bg-primary text-black text-sm font-semibold rounded-lg">
            Buscar
          </button>
        </div>
        {searchResult && searchType === "adversario" && (
          <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
            <span className="text-sm text-white">@{searchResult.username}</span>
            <button type="button" onClick={() => adicionarUsuario(searchResult!, "adversario")}
              className="text-xs text-primary font-semibold">Adicionar</button>
          </div>
        )}
        {adversarios.map(a => (
          <div key={a.id} className="flex items-center justify-between text-sm">
            <span className="text-white">@{a.username}</span>
            <button type="button" onClick={() => setAdversarios(p => p.filter(x => x.id !== a.id))}
              className="text-red-400 text-xs">Remover</button>
          </div>
        ))}
      </div>

      {/* Juízes */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-white">
          Juízes propostos <span className="text-muted-foreground font-normal">({judges.length}/7 — mín. 3)</span>
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Username do juiz"
            value={judgesInput} onChange={e => setJudgesInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), buscarUsuario(judgesInput, "juiz"))}
          />
          <button type="button" onClick={() => buscarUsuario(judgesInput, "juiz")}
            className="px-3 py-2 bg-primary text-black text-sm font-semibold rounded-lg">
            Buscar
          </button>
        </div>
        {searchResult && searchType === "juiz" && (
          <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
            <span className="text-sm text-white">@{searchResult.username}</span>
            <button type="button" onClick={() => adicionarUsuario(searchResult!, "juiz")}
              className="text-xs text-primary font-semibold">Adicionar</button>
          </div>
        )}
        {judges.map((j, i) => (
          <div key={j.id} className="flex items-center justify-between text-sm">
            <span className="text-white">Juiz {i + 1}: @{j.username}</span>
            <button type="button" onClick={() => setJudges(p => p.filter(x => x.id !== j.id))}
              className="text-red-400 text-xs">Remover</button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Os adversários podem aceitar ou rejeitar cada juiz e propor substitutos.
        </p>
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full py-3 bg-primary text-black font-bold rounded-xl disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar Aposta Privada"}
      </button>
    </form>
  );
}
