// Boxe · versão 1 — transcrição do manual `Modo_convocacao/zafe-boxe.docx` (6/ago/2026).
//
// "O primo do UFC" (§1): mesma estrutura de blocos, três diferenças de valor —
// mais decisões e menos nocaute (58% × 52%), até 12 rounds em vez de 5, e
// coeficiente de golpe menor (+0,21 × +0,3) para que o volume de uma luta longa
// não domine a pontuação.
//
// Nenhuma linha de motor foi escrita para este esporte. É a prova de que o DSL
// funciona: o manual inteiro é um INSERT.

import type { Ruleset } from "../rules";

const ANTES_DOS_CARTOES = ["ko", "tko", "rtd"];

export const boxeV1: Ruleset = {
  esporte: "boxe",
  versao: 1,
  tetoEvento: 180, // §7, confirmado como regra geral do modo
  pisoEvento: -25,
  agregacaoMes: "soma",
  evAlvo: 34.7, // §11

  regras: [
    // §2 — base. Derrota em −8, dois pontos acima do UFC: a distância maior
    // expõe mais o derrotado, e o bloco de desempenho já compensa.
    {
      tipo: "lookup",
      rotulo: "Resultado",
      stat: "resultado",
      mapa: { vitoria: 20, empate: 8, derrota: -8, no_contest: 0 },
    },

    // §3 — método. O TKO ganhou degrau próprio (+26 contra os +30 do KO limpo):
    // a contagem de proteção e a distância longa fazem dele um desfecho mais
    // comum e menos definitivo.
    {
      tipo: "lookup",
      rotulo: "Método",
      stat: "metodo",
      quando: [{ stat: "resultado", eq: "vitoria" }],
      mapa: {
        ko: 30,
        tko: 26,
        rtd: 22,
        decisao_unanime: 12,
        dq_adversario: 10,
        decisao_majoritaria: 9,
        decisao_dividida: 7,
      },
    },

    // §4 — round, reescalado para doze
    {
      tipo: "faixa",
      rotulo: "Round do fim",
      stat: "round_fim",
      quando: [
        { stat: "resultado", eq: "vitoria" },
        { stat: "metodo", in: ANTES_DOS_CARTOES },
      ],
      faixas: [
        { min: 1, max: 2, pontos: 15 },
        { min: 3, max: 4, pontos: 11 },
        { min: 5, max: 6, pontos: 8 },
        { min: 7, max: 9, pontos: 5 },
        { min: 10, max: 12, pontos: 3 },
      ],
    },
    {
      tipo: "limiar",
      rotulo: "Fim em até 60 segundos",
      stat: "tempo_seg",
      op: "<=",
      valor: 60,
      pontos: 8,
      quando: [
        { stat: "resultado", eq: "vitoria" },
        { stat: "metodo", in: ANTES_DOS_CARTOES },
      ],
    },

    // §5 — desempenho
    { tipo: "linear", rotulo: "Knockdowns aplicados", stat: "knockdowns", fator: 6 },
    { tipo: "linear", rotulo: "Knockdowns sofridos", stat: "knockdowns_sofridos", fator: -2 },
    { tipo: "linear", rotulo: "Golpes conectados", stat: "golpes_conectados", fator: 0.21 },
    { tipo: "linear", rotulo: "Golpes sofridos", stat: "golpes_sofridos", fator: -0.065 },

    // §6 — contexto. Prêmios da noite são OPCIONAIS no boxe: variam por
    // promotor. Card sem prêmio simplesmente não pontua estas linhas.
    {
      tipo: "flag",
      rotulo: "Vitória em luta de cinturão mundial",
      stat: "cinturao",
      pontos: 10,
      quando: [{ stat: "resultado", eq: "vitoria" }],
    },
    {
      tipo: "flag",
      rotulo: "Vitória em cinturão interino ou regional de elite",
      stat: "cinturao_interino",
      pontos: 5,
      quando: [{ stat: "resultado", eq: "vitoria" }],
    },
    { tipo: "flag", rotulo: "Fight of the Night", stat: "fotn", pontos: 6 },
    { tipo: "flag", rotulo: "Performance of the Night", stat: "potn", pontos: 10 },

    // §7 — penalidades
    { tipo: "linear", rotulo: "Pontos descontados pelo árbitro", stat: "pontos_descontados", fator: -3 },
    { tipo: "flag", rotulo: "Desqualificação", stat: "desqualificado", pontos: -20 },
    { tipo: "flag", rotulo: "Não bateu o peso e a luta aconteceu", stat: "nao_bateu_peso", pontos: -8 },
  ],

  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Resultado",
      opcoes: ["vitoria", "empate", "derrota", "no_contest"],
    },
    {
      key: "metodo",
      tipo: "cat",
      rotulo: "Método",
      opcoes: [
        "ko",
        "tko",
        "rtd",
        "decisao_unanime",
        "decisao_majoritaria",
        "decisao_dividida",
        "dq_adversario",
      ],
      ajuda: "rtd = desistência no córner",
    },
    { key: "round_fim", tipo: "num", rotulo: "Round do fim", ajuda: "1 a 12" },
    { key: "tempo_seg", tipo: "num", rotulo: "Tempo do round (segundos)" },
    { key: "knockdowns", tipo: "num", rotulo: "Knockdowns aplicados" },
    { key: "knockdowns_sofridos", tipo: "num", rotulo: "Knockdowns sofridos" },
    {
      key: "golpes_conectados",
      tipo: "num",
      rotulo: "Golpes conectados",
      ajuda: "CompuBox ou equivalente — todos os golpes, não só os de poder",
    },
    { key: "golpes_sofridos", tipo: "num", rotulo: "Golpes sofridos" },
    { key: "cinturao", tipo: "bool", rotulo: "Luta de cinturão mundial" },
    { key: "cinturao_interino", tipo: "bool", rotulo: "Luta de cinturão interino/regional" },
    { key: "fotn", tipo: "bool", rotulo: "Fight of the Night" },
    { key: "potn", tipo: "bool", rotulo: "Performance of the Night" },
    { key: "pontos_descontados", tipo: "num", rotulo: "Pontos descontados pelo árbitro" },
    { key: "desqualificado", tipo: "bool", rotulo: "Desqualificado" },
    { key: "nao_bateu_peso", tipo: "bool", rotulo: "Não bateu o peso (luta aconteceu)" },
  ],
};
