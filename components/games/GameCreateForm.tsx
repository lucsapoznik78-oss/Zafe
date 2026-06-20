"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GAME_KINDS, GAME_LABELS } from "@/lib/games/types";

// Formulário de criação de evento de usuário (modo grátis). O criador vira o
// juiz: resolve o vencedor depois que os palpites fecham. Sem Z$.
export default function GameCreateForm() {
  const router = useRouter();
  const [game, setGame] = useState(GAME_KINDS[0]);
  const [customGame, setCustomGame] = useState("");
  const [tournament, setTournament] = useState("");
  const [sideA, setSideA] = useState("");
  const [sideB, setSideB] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/games/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game,
          custom_game: game === "outros" ? customGame.trim() : null,
          tournament: tournament.trim() || null,
          side_a: sideA,
          side_b: sideB,
          closes_at: new Date(closesAt).toISOString(),
          starts_at: new Date(startsAt).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar evento");
        return;
      }
      router.push("/games");
      router.refresh();
    } catch {
      setError("Falha de rede — tente novamente");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg bg-input border border-border px-3 py-2 text-sm text-white focus:border-violet-400/60 focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Jogo</label>
        <select value={game} onChange={(e) => setGame(e.target.value as typeof game)} className={inputClass}>
          {GAME_KINDS.map((g) => (
            <option key={g} value={g}>
              {GAME_LABELS[g]}
            </option>
          ))}
        </select>
      </div>

      {game === "outros" && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Nome do jogo</label>
          <input
            value={customGame}
            onChange={(e) => setCustomGame(e.target.value)}
            maxLength={40}
            required
            placeholder="Ex.: Mortal Kombat, FIFA, Brawl Stars"
            className={inputClass}
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Campeonato (opcional)</label>
        <input
          value={tournament}
          onChange={(e) => setTournament(e.target.value)}
          maxLength={120}
          placeholder="Ex.: LBFF, VCT Americas, FUT Champions"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Lado A</label>
          <input value={sideA} onChange={(e) => setSideA(e.target.value)} maxLength={80} required placeholder="Time/jogador A" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Lado B</label>
          <input value={sideB} onChange={(e) => setSideB(e.target.value)} maxLength={80} required placeholder="Time/jogador B" className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Palpites fecham em</label>
          <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Jogo começa em</label>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={inputClass} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Os palpites devem fechar antes do início do jogo. Você será o juiz e resolve o vencedor depois que fechar — vale pontos e rank (sem Z$).
      </p>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-violet-500/20 border border-violet-400/50 text-violet-200 font-bold text-sm hover:bg-violet-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Criar evento
      </button>
    </form>
  );
}
