// Valorant · versão 1 — transcrição de `Modo_convocacao/zafe-valorant.docx` (7/ago/2026).
//
// Ver a convenção de leitura em `ufc.v1.ts`. Pontos são Z$.

import type { Ruleset } from "../rules";

export const valorantV1: Ruleset = {
  esporte: "valorant",
  versao: 1,
  tetoEvento: 9999,
  pisoEvento: -9999,
  agregacaoMes: "soma",

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado da série",
      stat: "resultado",
      mapa: { vitoria: 30, derrota: -10, nao_jogou: 0 },
    },
    { tipo: "flag", rotulo: "MVP da partida", stat: "mvp", pontos: 50 },
    { tipo: "linear", rotulo: "Aces", stat: "aces", fator: 20 },
    { tipo: "linear", rotulo: "Clutches vencidos", stat: "clutches", fator: 15 },
  ],

  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Resultado da série",
      opcoes: ["vitoria", "derrota", "nao_jogou"],
    },
    { key: "mvp", tipo: "bool", rotulo: "MVP da partida" },
    { key: "aces", tipo: "num", rotulo: "Aces (5 kills numa round)" },
    { key: "clutches", tipo: "num", rotulo: "Clutches vencidos" },
  ],
};
