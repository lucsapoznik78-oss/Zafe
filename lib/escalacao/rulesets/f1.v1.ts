// Fórmula 1 · versão 1 — transcrição do manual `Modo_convocacao/zafe-f1.docx` (6/ago/2026).
//
// Duas coisas deste manual mudaram o motor:
//
//   §3  a nota do mês é a MÉDIA das corridas em que o piloto largou, não a soma
//       — agosto e dezembro têm 1 GP e novembro tem 4, e somando ninguém
//       escalaria F1 fora de novembro. Virou `agregacaoMes: "media"`.
//   §5  posições ganhas valem +3 cada "até 10 posições, teto de +30" — virou
//       `teto` na regra linear.
//
// A unidade de EVENTO é o fim de semana, não a corrida: um GP com sprint conta
// como um só, com o sprint entrando como bônus dentro dele (§3).

import type { Ruleset } from "../rules";

export const f1V1: Ruleset = {
  esporte: "f1",
  versao: 1,
  tetoEvento: 180,
  pisoEvento: -25,
  agregacaoMes: "media",
  evAlvo: 33.9, // §9

  regras: [
    // §7 — qualificação
    { tipo: "flag", rotulo: "Pole position", stat: "pole", pontos: 12 },
    { tipo: "flag", rotulo: "Chegou ao Q3", stat: "q3", pontos: 6 },

    // §7 — sprint (um único fim de semana no período do card: Holanda, 23/08)
    {
      tipo: "faixa",
      rotulo: "Sprint",
      stat: "sprint_pos",
      faixas: [
        { min: 1, max: 1, pontos: 15 },
        { min: 2, max: 3, pontos: 9 },
        { min: 4, max: 8, pontos: 4 },
      ],
    },

    // §4 — corrida
    { tipo: "flag", rotulo: "Completou a corrida", stat: "completou", pontos: 5 },
    {
      tipo: "faixa",
      rotulo: "Posição de chegada",
      stat: "posicao",
      faixas: [
        { min: 1, max: 1, pontos: 40 },
        { min: 2, max: 2, pontos: 32 },
        { min: 3, max: 3, pontos: 28 },
        { min: 4, max: 4, pontos: 24 },
        { min: 5, max: 5, pontos: 20 },
        { min: 6, max: 6, pontos: 17 },
        { min: 7, max: 7, pontos: 15 },
        { min: 8, max: 8, pontos: 12 },
        { min: 9, max: 9, pontos: 10 },
        { min: 10, max: 10, pontos: 8 },
        { min: 11, max: 15, pontos: 6 },
        { min: 16, max: 99, pontos: 4 },
      ],
    },
    // §4: abandono não distingue causa. Separar exigiria atribuir culpa, que é
    // julgamento — e o manual inteiro se recusa a usar julgamento (art. 49 II).
    { tipo: "flag", rotulo: "Não classificado", stat: "nao_classificado", pontos: -10 },

    // §5 — posições ganhas e perdidas. O teto de +30 impede que a penalidade de
    // troca de motor, previsível com semanas de antecedência, renda mais que
    // vencer a corrida.
    { tipo: "linear", rotulo: "Posições ganhas", stat: "posicoes_ganhas", fator: 3, teto: 30 },
    { tipo: "linear", rotulo: "Posições perdidas", stat: "posicoes_perdidas", fator: -2 },

    // §7 — volta rápida, só se terminar entre os dez primeiros
    {
      tipo: "flag",
      rotulo: "Volta mais rápida",
      stat: "volta_rapida",
      pontos: 7,
      quando: [{ stat: "posicao", lte: 10 }],
    },

    // §6 — o duelo com o companheiro de equipe. 32% da pontuação total sai
    // daqui: é a única comparação do esporte feita com material idêntico, e é o
    // que mantém as vinte vagas do grid escaláveis em vez de o modo virar uma
    // lista de compras das duas equipes da frente.
    { tipo: "flag", rotulo: "Terminou à frente do companheiro", stat: "venceu_duelo_corrida", pontos: 14 },
    { tipo: "flag", rotulo: "Largou à frente do companheiro", stat: "venceu_duelo_quali", pontos: 8 },

    // §8 — penalidades
    { tipo: "linear", rotulo: "Penalidades de tempo", stat: "penalidades_tempo", fator: -6 },
    { tipo: "flag", rotulo: "Penalidade de grid", stat: "penalidade_grid", pontos: -6 },
    { tipo: "flag", rotulo: "Desqualificação", stat: "desqualificado", pontos: -20 },
  ],

  stats: [
    { key: "pole", tipo: "bool", rotulo: "Pole position", ajuda: "Posição de largada, já com penalidades" },
    { key: "q3", tipo: "bool", rotulo: "Chegou ao Q3" },
    { key: "sprint_pos", tipo: "num", rotulo: "Posição no sprint", ajuda: "Deixe vazio se não houve sprint" },
    { key: "completou", tipo: "bool", rotulo: "Completou a corrida" },
    {
      key: "posicao",
      tipo: "num",
      rotulo: "Posição de chegada",
      ajuda: "Classificação oficial final, após os comissários. Vazio se abandonou",
    },
    { key: "nao_classificado", tipo: "bool", rotulo: "Abandono / não classificado" },
    { key: "posicoes_ganhas", tipo: "num", rotulo: "Posições ganhas do grid à chegada" },
    { key: "posicoes_perdidas", tipo: "num", rotulo: "Posições perdidas" },
    { key: "volta_rapida", tipo: "bool", rotulo: "Volta mais rápida da corrida" },
    { key: "venceu_duelo_corrida", tipo: "bool", rotulo: "Terminou à frente do companheiro" },
    { key: "venceu_duelo_quali", tipo: "bool", rotulo: "Largou à frente do companheiro" },
    { key: "penalidades_tempo", tipo: "num", rotulo: "Penalidades de tempo aplicadas" },
    { key: "penalidade_grid", tipo: "bool", rotulo: "Largou com penalidade de grid" },
    { key: "desqualificado", tipo: "bool", rotulo: "Desqualificado" },
  ],
};
