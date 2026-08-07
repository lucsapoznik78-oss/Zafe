// Futebol · versão 1 — transcrição de `Modo_convocacao/zafe-futebol.docx` (7/ago/2026).
//
// Ver a convenção de leitura em `ufc.v1.ts`. Pontos são Z$.
//
// Vitória / empate / derrota / não jogou são a mesma dimensão (o resultado do
// time) e por isso um lookup. Gols, assistências, cartão e gol contra são
// individuais e SOMAM por cima — um atacante que marca dois e ganha faz
// 50 + 50 + 30 = 130.

import type { Ruleset } from "../rules";

export const futebolV1: Ruleset = {
  esporte: "futebol",
  versao: 1,
  tetoEvento: 9999,
  pisoEvento: -9999,
  // "pontua por jogo" — na fase de liga da Champions são até 2 jogos no mês.
  agregacaoMes: "soma",

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado do time",
      stat: "resultado",
      mapa: { vitoria: 30, empate: 10, derrota: -10, nao_jogou: 0 },
    },
    { tipo: "linear", rotulo: "Gols marcados", stat: "gols", fator: 50 },
    { tipo: "linear", rotulo: "Assistências", stat: "assistencias", fator: 25 },
    { tipo: "flag", rotulo: "Jogo sem sofrer gol", stat: "sem_sofrer_gol", pontos: 20 },
    { tipo: "flag", rotulo: "Cartão vermelho", stat: "cartao_vermelho", pontos: -20 },
    { tipo: "linear", rotulo: "Gol contra", stat: "gols_contra", fator: -20 },
  ],

  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Resultado do time",
      opcoes: ["vitoria", "empate", "derrota", "nao_jogou"],
    },
    { key: "gols", tipo: "num", rotulo: "Gols marcados" },
    { key: "assistencias", tipo: "num", rotulo: "Assistências" },
    {
      key: "sem_sofrer_gol",
      tipo: "bool",
      rotulo: "Jogo sem sofrer gol",
      ajuda: "Só para goleiro ou zagueiro",
    },
    { key: "cartao_vermelho", tipo: "bool", rotulo: "Cartão vermelho" },
    { key: "gols_contra", tipo: "num", rotulo: "Gols contra" },
  ],
};
