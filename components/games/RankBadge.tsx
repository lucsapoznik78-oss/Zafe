import { Shield } from "lucide-react";
import type { GamesTier } from "@/lib/games/types";
import { TIER_LABELS } from "@/lib/games/types";

// Cores por rank (gamificação). Derivado de events_won no servidor.
//
// EXCEÇÃO DECLARADA à migração de paleta: é uma escala ordinal de 7 degraus, e
// codificar a ordem é a função da cor aqui. Mapear para os tokens colapsaria
// bronze e ouro no mesmo amarelo e ferro e prata no mesmo cinza — o usuário
// perderia de vista em que degrau está. Único ponto do app onde ainda aparece
// um roxo (fuchsia, no rank máximo); listado no relatório de entrega.
const TIER_STYLE: Record<GamesTier, string> = {
  ferro: "bg-zinc-600/20 text-zinc-300 border-zinc-500/30",
  bronze: "bg-amber-800/20 text-amber-500 border-amber-700/30",
  prata: "bg-slate-400/20 text-slate-200 border-slate-300/30",
  ouro: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  platina: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
  diamante: "bg-sky-400/20 text-sky-300 border-sky-400/30",
  mestre: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
};

export default function RankBadge({ tier, size = "sm" }: { tier: GamesTier; size?: "sm" | "md" }) {
  const px = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${px} ${TIER_STYLE[tier]}`}
    >
      <Shield size={size === "md" ? 12 : 10} /> {TIER_LABELS[tier]}
    </span>
  );
}
