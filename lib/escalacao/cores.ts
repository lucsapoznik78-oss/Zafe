// A paleta por esporte, fora de qualquer componente.
//
// Vivia em `FotoAtleta.tsx`, que é `"use client"` — e um módulo de cliente só
// exporta referências para o servidor: um Server Component que importasse
// `corDoEsporte` dali receberia um proxy e estouraria ao chamá-lo. Como o
// seletor de Convocações é servidor e o campo é cliente, a cor precisa morar
// num módulo neutro que os dois possam importar.

export const COR_ESPORTE: Record<string, string> = {
  ufc: "from-red-500/30 to-red-900/30 text-red-200 ring-red-400/40",
  boxe: "from-amber-500/30 to-amber-900/30 text-amber-200 ring-amber-400/40",
  f1: "from-sky-500/30 to-sky-900/30 text-sky-200 ring-sky-400/40",
  surf: "from-cyan-500/30 to-cyan-900/30 text-cyan-200 ring-cyan-400/40",
  futebol: "from-emerald-500/30 to-emerald-900/30 text-emerald-200 ring-emerald-400/40",
  nba: "from-orange-500/30 to-orange-900/30 text-orange-200 ring-orange-400/40",
  nfl: "from-indigo-500/30 to-indigo-900/30 text-indigo-200 ring-indigo-400/40",
  tenis: "from-lime-500/30 to-lime-900/30 text-lime-200 ring-lime-400/40",
  valorant: "from-fuchsia-500/30 to-fuchsia-900/30 text-fuchsia-200 ring-fuchsia-400/40",
};

const PADRAO = "from-white/20 to-white/5 text-white/80 ring-white/30";

export function corDoEsporte(esporte: string): string {
  return COR_ESPORTE[esporte] ?? PADRAO;
}
