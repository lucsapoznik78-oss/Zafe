// NFL · versão 2 — recalibragem de escala do `nfl.v1`. Ver `futebol.v2.ts` para
// o motivo: o time do modo fixo pontua no mês inteiro, não numa partida.
//
// Toda a tabela é a da v1 dividida por 5 — exatamente, sem exceção. O manual
// julgou bem o que vale mais que o quê (um touchdown continua valendo 1,67
// vitória); o que estava errado era só a escala, porque ele foi escrito para uma
// partida e o modo soma quatro.

import type { Ruleset } from "../rules";

export const nflV2: Ruleset = {
  esporte: "nfl",
  versao: 2,
  tetoEvento: 9999,
  pisoEvento: -9999,
  agregacaoMes: "soma",
  // Por atleta, por MÊS (≈4 jogos). 11 titulares × 18 ≈ 200.
  evAlvo: 18,

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado do time",
      stat: "resultado",
      mapa: { vitoria: 6, derrota: -2, nao_jogou: 0 },
    },
    { tipo: "linear", rotulo: "Touchdowns marcados", stat: "touchdowns", fator: 10 },
    { tipo: "linear", rotulo: "Passes para touchdown", stat: "passes_td", fator: 4 },
    { tipo: "linear", rotulo: "Field goal / defesa decisiva", stat: "jogadas_decisivas", fator: 2 },
    { tipo: "linear", rotulo: "Turnovers", stat: "turnovers", fator: -4 },
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
