// NBA · versão 2 — recalibragem de escala do `nba.v1`. Ver `futebol.v2.ts` para
// o motivo: o time do modo fixo pontua no mês inteiro, não numa partida.
//
// Toda a tabela é a da v1 dividida por 5 — o mesmo fator do Brasileirão e da
// NFL, ainda que a NBA tenha ~13 jogos no mês contra ~4 deles. O que equilibra é
// o tamanho do time: 5 titulares × 13 jogos dá 65 atuações no mês, contra 44 de
// um time de 11 que joga 4 vezes. O que o modo emite é o produto dos dois.
//
// Triple-double e double-double continuam EXCLUSIVOS entre si (todo
// triple-double é também um double-double).

import type { Ruleset } from "../rules";

export const nbaV2: Ruleset = {
  esporte: "nba",
  versao: 2,
  tetoEvento: 9999,
  pisoEvento: -9999,
  agregacaoMes: "soma",
  // Por atleta, por MÊS (≈13 jogos). 5 titulares × 40 ≈ 200.
  evAlvo: 40,

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado do time",
      stat: "resultado",
      mapa: { vitoria: 6, derrota: -2, nao_jogou: 0 },
    },
    {
      tipo: "lookup",
      rotulo: "Duplo-duplo",
      stat: "duplo",
      mapa: { triple_double: 10, double_double: 4, nenhum: 0 },
    },
    { tipo: "flag", rotulo: "Cesta da vitória / MVP do jogo", stat: "mvp", pontos: 4 },
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
