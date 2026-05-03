"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, UserPlus, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const CATEGORIES = ["politica","esportes","cultura","economia","tecnologia","entretenimento","outros"];

interface UserRow { id: string; username: string; full_name: string }

function UserPicker({
  label,
  sublabel,
  selected,
  allUsers,
  loading,
  maxSelect,
  onAdd,
  onRemove,
  userId,
}: {
  label: string;
  sublabel?: string;
  selected: UserRow[];
  allUsers: UserRow[];
  loading: boolean;
  maxSelect?: number;
  onAdd: (u: UserRow) => void;
  onRemove: (id: string) => void;
  userId: string;
}) {
  const [query, setQuery] = useState("");
  const selectedIds = new Set(selected.map((u) => u.id));

  const filtered = allUsers.filter((u) => {
    if (u.id === userId) return false;
    const q = query.toLowerCase();
    return !query.trim() || u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {label}{" "}
          {sublabel && <span className="text-muted-foreground font-normal">{sublabel}</span>}
        </p>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((u) => (
            <span key={u.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 text-primary text-xs rounded-full font-medium">
              @{u.username}
              <button type="button" onClick={() => onRemove(u.id)} className="hover:text-red-400 transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nome ou usuário..."
          className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">Nenhum usuário encontrado</p>
      ) : (
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          {filtered.map((u) => {
            const initials = u.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
            const isSelected = selectedIds.has(u.id);
            const atMax = maxSelect != null && selected.length >= maxSelect;

            return (
              <div key={u.id} className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  {isSelected ? (
                    <button
                      type="button"
                      onClick={() => onRemove(u.id)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1"
                    >
                      <X size={12} /> Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAdd(u)}
                      disabled={atMax}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <UserPlus size={12} /> Adicionar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CreatePrivateBetForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("outros");
  const [minBet, setMinBet] = useState("10");
  const [closesAt, setClosesAt] = useState("");
  const [adversarios, setAdversarios] = useState<UserRow[]>([]);
  const [judges, setJudges] = useState<UserRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    createClient()
      .from("profiles")
      .select("id, username, full_name")
      .neq("id", userId)
      .eq("is_admin", false)
      .order("full_name", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        setAllUsers(data ?? []);
        setLoadingUsers(false);
      });
  }, [userId]);

  function addAdversario(u: UserRow) {
    if ([...adversarios, ...judges].find((x) => x.id === u.id)) {
      setError("Usuário já adicionado em outra lista");
      return;
    }
    setAdversarios((p) => [...p, u]);
    setError("");
  }

  function addJudge(u: UserRow) {
    if (judges.length >= 7) { setError("Máximo de 7 juízes"); return; }
    if ([...adversarios, ...judges].find((x) => x.id === u.id)) {
      setError("Usuário já adicionado em outra lista");
      return;
    }
    setJudges((p) => [...p, u]);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (adversarios.length < 1) { setError("Adicione pelo menos 1 adversário"); return; }
    if (judges.length < 1 || judges.length > 7 || judges.length % 2 === 0) {
      setError("Número de juízes deve ser ímpar: 1, 3, 5 ou 7");
      return;
    }
    if (!title || !closesAt) { setError("Preencha todos os campos"); return; }

    setLoading(true);
    setError("");
    try {
      const closesDate = new Date(closesAt);
      if (closesDate.getHours() === 0 && closesDate.getMinutes() === 0) {
        closesDate.setHours(23, 59, 59, 0);
      }
      const res = await fetch("/api/apostas-privadas/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, category,
          min_bet: parseFloat(minBet),
          closes_at: closesDate.toISOString(),
          adversario_ids: adversarios.map((a) => a.id),
          judge_ids: judges.map((j) => j.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao criar bolão"); return; }
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
          <label className="text-xs text-muted-foreground">Pergunta do bolão</label>
          <input
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Ex: Palmeiras vai ganhar o Brasileirão 2026?"
            value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
          <textarea
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm resize-none"
            rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Categoria</label>
            <select
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
              value={category} onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Palpite mínimo (Z$)</label>
            <input
              type="number" min="1" step="1"
              className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
              value={minBet} onChange={(e) => setMinBet(e.target.value)} required
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Data do evento</label>
          <input
            type="datetime-local"
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-white text-sm"
            value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required
          />
        </div>
      </div>

      <UserPicker
        label="Adversários"
        sublabel="(Lado B — apostam NÃO)"
        selected={adversarios}
        allUsers={allUsers}
        loading={loadingUsers}
        userId={userId}
        onAdd={addAdversario}
        onRemove={(id) => setAdversarios((p) => p.filter((x) => x.id !== id))}
      />

      <UserPicker
        label="Juízes propostos"
        sublabel={`(${judges.length}/7 — ímpar: 1, 3, 5 ou 7)`}
        selected={judges}
        allUsers={allUsers}
        loading={loadingUsers}
        maxSelect={7}
        userId={userId}
        onAdd={addJudge}
        onRemove={(id) => setJudges((p) => p.filter((x) => x.id !== id))}
      />
      <p className="text-xs text-muted-foreground -mt-3 px-1">
        Número ímpar garante desempate na votação. Os adversários podem aceitar ou rejeitar cada juiz.
      </p>

      <button
        type="submit" disabled={loading}
        className="w-full py-3 bg-primary text-black font-bold rounded-xl disabled:opacity-50"
      >
        {loading ? "Criando..." : "Criar Bolão"}
      </button>
    </form>
  );
}
