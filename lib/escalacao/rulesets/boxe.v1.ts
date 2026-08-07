// Boxe · versão 1 — transcrição de `Modo_convocacao/zafe-boxe.docx` (7/ago/2026).
//
// Idêntico ao UFC exceto por não ter finalização. Ver a convenção de leitura em
// `ufc.v1.ts`. Pontos são Z$.

import type { Ruleset } from "../rules";

export const boxeV1: Ruleset = {
  esporte: "boxe",
  versao: 1,
  tetoEvento: 9999,
  pisoEvento: -9999,
  agregacaoMes: "soma",

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado da luta",
      stat: "resultado",
      mapa: {
        vitoria: 30,
        vitoria_ko: 50,
        derrota: -10,
        derrota_ko: -20,
        no_contest: 0,
        nao_competiu: 0,
      },
    },
    { tipo: "flag", rotulo: "Luta de cinturão vencida", stat: "cinturao", pontos: 20 },
  ],

  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Resultado",
      opcoes: ["vitoria", "vitoria_ko", "derrota", "derrota_ko", "no_contest", "nao_competiu"],
    },
    { key: "cinturao", tipo: "bool", rotulo: "Venceu luta de cinturão" },
  ],
};
