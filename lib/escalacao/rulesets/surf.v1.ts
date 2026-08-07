// Surf · versão 1 — transcrição de `Modo_convocacao/zafe-surf.docx` (7/ago/2026).
//
// Ver a convenção de leitura em `ufc.v1.ts`. Pontos são Z$.
//
// "Passou de bateria +15 (por bateria)" é a única linha contada por unidade:
// vira `linear` sobre a CONTAGEM de baterias vencidas, não um flag.
//
// As fases (quartas, semi, vice, campeão) são um lookup EXCLUSIVO — a fase mais
// alta que o surfista alcançou. Somar as quatro daria 215 de bônus a um campeão,
// e o manual apresenta uma tabela de estágios, não uma escada cumulativa.

import type { Ruleset } from "../rules";

export const surfV1: Ruleset = {
  esporte: "surf",
  versao: 1,
  tetoEvento: 9999,
  pisoEvento: -9999,
  // "no stop designado do mês" — só o stop apontado em
  // `escalacao_card_esporte.evento_key` conta.
  agregacaoMes: "designado",

  regras: [
    { tipo: "flag", rotulo: "Entrou na chave", stat: "entrou_chave", pontos: 5 },
    { tipo: "linear", rotulo: "Baterias vencidas", stat: "baterias_vencidas", fator: 15 },
    {
      tipo: "lookup",
      rotulo: "Fase alcançada",
      stat: "fase",
      mapa: { quartas: 25, semifinal: 40, vice: 60, campeao: 90, nenhuma: 0 },
    },
    {
      tipo: "flag",
      rotulo: "Eliminado na primeira bateria",
      stat: "eliminado_primeira",
      pontos: -5,
    },
  ],

  stats: [
    { key: "entrou_chave", tipo: "bool", rotulo: "Entrou na chave" },
    { key: "baterias_vencidas", tipo: "num", rotulo: "Baterias vencidas" },
    {
      key: "fase",
      tipo: "cat",
      rotulo: "Fase alcançada",
      opcoes: ["nenhuma", "quartas", "semifinal", "vice", "campeao"],
      ajuda: "A mais alta que ele alcançou — os bônus não se somam",
    },
    { key: "eliminado_primeira", tipo: "bool", rotulo: "Eliminado na primeira bateria" },
  ],
};
