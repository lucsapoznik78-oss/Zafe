// NFL · versão 1 — transcrição de `Modo_convocacao/zafe-nfl.docx` (7/ago/2026).
//
// Ver a convenção de leitura em `ufc.v1.ts`. Pontos são Z$.

import type { Ruleset } from "../rules";

export const nflV1: Ruleset = {
  esporte: "nfl",
  versao: 1,
  tetoEvento: 9999,
  pisoEvento: -9999,
  agregacaoMes: "soma",

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado do time",
      stat: "resultado",
      mapa: { vitoria: 30, derrota: -10, nao_jogou: 0 },
    },
    { tipo: "linear", rotulo: "Touchdowns marcados", stat: "touchdowns", fator: 50 },
    { tipo: "linear", rotulo: "Passes para touchdown", stat: "passes_td", fator: 20 },
    { tipo: "linear", rotulo: "Field goal / defesa decisiva", stat: "jogadas_decisivas", fator: 10 },
    { tipo: "linear", rotulo: "Turnovers", stat: "turnovers", fator: -20 },
  ],

  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Resultado do time",
      opcoes: ["vitoria", "derrota", "nao_jogou"],
    },
    { key: "touchdowns", tipo: "num", rotulo: "Touchdowns marcados" },
    { key: "passes_td", tipo: "num", rotulo: "Passes para touchdown" },
    {
      key: "jogadas_decisivas",
      tipo: "num",
      rotulo: "Field goals / defesas decisivas",
      ajuda: "Quantidade, não pontos do placar",
    },
    { key: "turnovers", tipo: "num", rotulo: "Turnovers (interceptação ou fumble)" },
  ],
};
