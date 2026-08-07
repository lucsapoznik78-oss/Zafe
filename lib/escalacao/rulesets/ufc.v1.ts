// UFC · versão 1 — transcrição de `Modo_convocacao/zafe-ufc.docx` (7/ago/2026).
//
// CONVENÇÃO DE LEITURA DOS MANUAIS SIMPLIFICADOS (vale para os nove):
//   · linha marcada "(bonus)" → SOMA por cima
//   · linhas não marcadas da mesma dimensão → EXCLUSIVAS entre si (um lookup)
// Aqui: "Vitória +30" e "Vitória por nocaute ou finalização +50" descrevem a
// mesma dimensão (o desfecho da luta), então nocaute vale 50 — não 80.
//
// Os pontos SÃO Z$. Não há conversão: +30 no manual é +30 Z$ na carteira.

import type { Ruleset } from "../rules";

export const ufcV1: Ruleset = {
  esporte: "ufc",
  versao: 1,
  // Os manuais simplificados não estabelecem teto nem piso por evento. Impor um
  // clamp aqui contrariaria o manual; a proteção da economia é o disjuntor por
  // card (`escalacao_card.teto_emissao_z`), que recusa o pagamento por inteiro.
  tetoEvento: 9999,
  pisoEvento: -9999,
  // "Um lutador pontua por luta" — duas lutas no mesmo mês somam.
  agregacaoMes: "soma",

  regras: [
    {
      tipo: "lookup",
      rotulo: "Resultado da luta",
      stat: "resultado",
      mapa: {
        vitoria: 30,
        vitoria_ko: 50,
        vitoria_finalizacao: 50,
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
      opcoes: [
        "vitoria",
        "vitoria_ko",
        "vitoria_finalizacao",
        "derrota",
        "derrota_ko",
        "no_contest",
        "nao_competiu",
      ],
    },
    {
      key: "cinturao",
      tipo: "bool",
      rotulo: "Venceu luta de cinturão",
      ajuda: "Só marque junto de uma vitória — o bônus é de vitória em luta de cinturão",
    },
  ],
};
