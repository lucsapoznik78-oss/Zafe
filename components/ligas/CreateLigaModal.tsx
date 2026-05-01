"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Trophy, Globe, Lock } from "lucide-react";

const COLORS = [
  "#86efac", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa", "#34d399", "#fbbf24",
];

interface Props {
  onClose: () => void;
  parentLigaId?: string;
  parentLigaName?: string;
  myPrivateLigas?: { id: string; name: string }[];
}

export default function CreateLigaModal({ onClose, parentLigaId, parentLigaName, myPrivateLigas }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [isPublic, setIsPublic] = useState(false);
  const [selectedParent, setSelectedParent] = useState(parentLigaId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSubLiga = !!selectedParent;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nome obrigatório"); return; }
    setLoading(true);
    const res = await fetch("/api/ligas/criar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        color,
        is_public: isSubLiga ? false : isPublic,
        parent_liga_id: selectedParent || null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Erro ao criar liga"); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl p-5 w-full max-w-md z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={18} style={{ color }} />
            <h3 className="text-white font-semibold">
              {isSubLiga ? "Criar Sub-liga" : "Criar Nova Liga"}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X size={18} />
          </button>
        </div>

        {isSubLiga && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            <Lock size={12} className="text-primary shrink-0" />
            <p className="text-xs text-primary">
              Sub-liga privada dentro de <strong>{parentLigaName ?? "liga selecionada"}</strong>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Public/Private toggle — only for root leagues */}
          {!parentLigaId && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tipo de liga</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setIsPublic(false); setSelectedParent(""); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    !isPublic && !selectedParent
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-white"
                  }`}
                >
                  <Lock size={14} />
                  Privada
                </button>
                <button
                  type="button"
                  onClick={() => { setIsPublic(true); setSelectedParent(""); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    isPublic
                      ? "border-sim bg-sim/10 text-sim"
                      : "border-border text-muted-foreground hover:text-white"
                  }`}
                >
                  <Globe size={14} />
                  Pública
                </button>
              </div>
              {isPublic && (
                <p className="text-[11px] text-muted-foreground">Qualquer pessoa pode entrar sem convite.</p>
              )}
              {!isPublic && !selectedParent && (
                <p className="text-[11px] text-muted-foreground">Apenas membros convidados podem entrar.</p>
              )}
            </div>
          )}

          {/* Sub-liga selector — for private leagues the user is in */}
          {!parentLigaId && !isPublic && (myPrivateLigas?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Criar como sub-liga de (opcional)</label>
              <select
                value={selectedParent}
                onChange={(e) => setSelectedParent(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
              >
                <option value="">— Liga raiz —</option>
                {(myPrivateLigas ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Nome da Liga *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="Ex: Turma do Colégio, Família Silva..."
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <p className="text-[10px] text-muted-foreground text-right">{name.length}/50</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder="Sobre o que é essa liga..."
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Cor da liga</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    transform: color === c ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-bold text-sm text-black transition-colors"
            style={{ backgroundColor: color }}
          >
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : isSubLiga ? "Criar Sub-liga" : "Criar Liga"}
          </button>
        </form>
      </div>
    </div>
  );
}
