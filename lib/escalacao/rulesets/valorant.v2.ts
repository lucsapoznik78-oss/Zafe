// Valorant · versão 2 — recalibragem de escala do `valorant.v1`. Ver
// `futebol.v2.ts` para o motivo: o time do modo fixo pontua no mês inteiro.
//
// É a menos distorcida das quatro, e por isso o único fator diferente: a tabela
// da v1 dividida por 2,5, não por 5. São ~4 séries no mês para um time de 5, ou
// seja 20 atuações — menos da metade das 44 de um time de futebol e um terço das
// 65 da NBA. Dividir por 5 aqui faria o Valorant emitir 88 Z$ contra 200 de
// entrada, e ninguém escalaria nele.

import type { Ruleset } from "../rules";

export const valorantV2: Ruleset = {
  esporte: "valorant",
  versao: 2,
  tetoEvento: 9999,
  pisoEvento: -9999,
  agregacaoMes: "soma",
  // Por atleta, por MÊS (≈4 séries). 5 titulares × 40 ≈ 200.
  evAlvo: 40,

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado da série",
      stat: "resultado",
      mapa: { vitoria: 12, derrota: -4, nao_jogou: 0 },
    },
    { tipo: "flag", rotulo: "MVP da partida", stat: "mvp", pontos: 20 },
    { tipo: "linear", rotulo: "Aces", stat: "aces", fator: 8 },
    { tipo: "linear", rotulo: "Clutches vencidos", stat: "clutches", fator: 6 },
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
