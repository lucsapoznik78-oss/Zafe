// Tênis · versão 1 — transcrição de `Modo_convocacao/zafe-tenis.docx` (7/ago/2026).
//
// Gêmeo do surf: mesma tabela, "rodada" no lugar de "bateria" e "torneio" no
// lugar de "stop". Ver a convenção de leitura em `ufc.v1.ts`. Pontos são Z$.

import type { Ruleset } from "../rules";

export const tenisV1: Ruleset = {
  esporte: "tenis",
  versao: 1,
  tetoEvento: 9999,
  pisoEvento: -9999,
  agregacaoMes: "designado",

  regras: [
    { tipo: "flag", rotulo: "Entrou na chave", stat: "entrou_chave", pontos: 5 },
    { tipo: "linear", rotulo: "Rodadas vencidas", stat: "rodadas_vencidas", fator: 15 },
    {
      tipo: "lookup",
      rotulo: "Fase alcançada",
      stat: "fase",
      mapa: { quartas: 25, semifinal: 40, vice: 60, campeao: 90, nenhuma: 0 },
    },
    {
      tipo: "flag",
      rotulo: "Eliminado na primeira rodada",
      stat: "eliminado_primeira",
      pontos: -5,
    },
  ],

  stats: [
    { key: "entrou_chave", tipo: "bool", rotulo: "Entrou na chave" },
    { key: "rodadas_vencidas", tipo: "num", rotulo: "Rodadas vencidas" },
    {
      key: "fase",
      tipo: "cat",
      rotulo: "Fase alcançada",
      opcoes: ["nenhuma", "quartas", "semifinal", "vice", "campeao"],
      ajuda: "A mais alta que ele alcançou — os bônus não se somam",
    },
    { key: "eliminado_primeira", tipo: "bool", rotulo: "Eliminado na primeira rodada" },
  ],
};
