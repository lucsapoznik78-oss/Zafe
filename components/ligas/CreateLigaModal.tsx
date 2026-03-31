"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Trophy } from "lucide-react";

const COLORS = [
  "#86efac", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa", "#34d399", "#fbbf24",
];

interface Props {
  onClose: () => void;
}

export default function CreateLigaModal({ onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nome obrigatório"); return; }
    setLoading(true);
    const res = await fetch("/api/ligas/criar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, color }),
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
            <h3 className="text-white font-semibold">Criar Nova Liga</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Criar Liga"}
          </button>
        </form>
      </div>
    </div>
  );
}
