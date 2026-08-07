// Fórmula 1 · versão 1 — transcrição de `Modo_convocacao/zafe-f1.docx` (7/ago/2026).
//
// Ver a convenção de leitura em `ufc.v1.ts`. Pontos são Z$.

import type { Ruleset } from "../rules";

export const f1V1: Ruleset = {
  esporte: "f1",
  versao: 1,
  tetoEvento: 9999,
  pisoEvento: -9999,
  // "média do mês quando houver várias". Não é preferência de estilo: agosto tem
  // 1 GP e novembro tem 4. Somando, um piloto escalado no mês cheio valeria
  // quatro vezes um do mês vazio e todo mundo lotaria as vagas de F1 em novembro.
  agregacaoMes: "media",

  regras: [
    {
      tipo: "lookup",
      rotulo: "Posição no GP",
      stat: "resultado",
      mapa: {
        vitoria: 50,
        podio: 30,
        top10: 15,
        classificado: 5,
        abandono: -10,
        nao_largou: -10,
      },
    },
    { tipo: "flag", rotulo: "Pole position", stat: "pole", pontos: 10 },
  ],

  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Posição final",
      opcoes: ["vitoria", "podio", "top10", "classificado", "abandono", "nao_largou"],
      ajuda: "podio = 2º ou 3º · top10 = 4º ao 10º · classificado = 11º em diante",
    },
    { key: "pole", tipo: "bool", rotulo: "Pole position" },
  ],
};
