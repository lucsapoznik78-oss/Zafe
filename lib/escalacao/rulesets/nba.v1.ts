// NBA · versão 1 — transcrição de `Modo_convocacao/zafe-nba.docx` (7/ago/2026).
//
// Ver a convenção de leitura em `ufc.v1.ts`. Pontos são Z$.
//
// Triple-double e double-double são EXCLUSIVOS entre si: todo triple-double é
// também um double-double, e somar os dois pagaria +70 por uma coisa só.

import type { Ruleset } from "../rules";

export const nbaV1: Ruleset = {
  esporte: "nba",
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
    {
      tipo: "lookup",
      rotulo: "Duplo-duplo",
      stat: "duplo",
      mapa: { triple_double: 50, double_double: 20, nenhum: 0 },
    },
    { tipo: "flag", rotulo: "Cesta da vitória / MVP do jogo", stat: "mvp", pontos: 20 },
  ],

  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Resultado do time",
      opcoes: ["vitoria", "derrota", "nao_jogou"],
    },
    {
      key: "duplo",
      tipo: "cat",
      rotulo: "Duplo-duplo",
      opcoes: ["nenhum", "double_double", "triple_double"],
    },
    { key: "mvp", tipo: "bool", rotulo: "Cesta da vitória ou MVP do jogo" },
  ],
};
