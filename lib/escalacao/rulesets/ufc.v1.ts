// UFC · versão 1 — transcrição do manual `Modo_convocacao/zafe-ufc.docx` (6/ago/2026).
//
// Este arquivo é a fonte para o INSERT em `escalacao_regra`; o banco é quem
// manda em produção (scripts/seed-escalacao-regras.mjs). O literal existe aqui
// para ser tipado pelo zod e testado contra os seis exemplos apurados do §12.
//
// Ordem das regras = ordem dos blocos do manual (§1), porque é a ordem em que o
// usuário lê o detalhamento exigido pelo Art. 34.

import type { Ruleset } from "../rules";

// §4 vale "quando a luta termina antes do tempo — nocaute, nocaute técnico ou
// finalização". Transcrevo à risca. `tko_lesao` (desistência do adversário) e
// `dq_adversario` também terminam antes do tempo, mas o manual não os cita e o
// §3 já os trata como desfecho de sorte, não de domínio — incluí-los seria
// emenda, não transcrição. Está na lista de pendências.
const ANTES_DO_TEMPO = ["ko", "finalizacao", "tko_medico"];

export const ufcV1: Ruleset = {
  esporte: "ufc",
  versao: 1,
  tetoEvento: 180,   // surf §7, adotado como regra geral do modo
  pisoEvento: -25,   // UFC §11: o pior caso natural da simulação foi −24,5
  agregacaoMes: "soma", // §9: duas lutas na janela somam
  evAlvo: 33.5,      // §11

  regras: [
    // §2 — base
    {
      tipo: "lookup",
      rotulo: "Resultado",
      stat: "resultado",
      mapa: { vitoria: 20, empate: 8, derrota: -10, no_contest: 0 },
    },

    // §3 — método (só o vencedor)
    {
      tipo: "lookup",
      rotulo: "Método",
      stat: "metodo",
      quando: [{ stat: "resultado", eq: "vitoria" }],
      mapa: {
        ko: 30,
        finalizacao: 25,
        tko_medico: 22,
        decisao_unanime: 12,
        tko_lesao: 12,
        dq_adversario: 10,
        decisao_dividida: 8,
      },
    },

    // §4 — velocidade
    {
      tipo: "faixa",
      rotulo: "Round do fim",
      stat: "round_fim",
      quando: [
        { stat: "resultado", eq: "vitoria" },
        { stat: "metodo", in: ANTES_DO_TEMPO },
      ],
      faixas: [
        { min: 1, max: 1, pontos: 15 },
        { min: 2, max: 2, pontos: 10 },
        { min: 3, max: 3, pontos: 6 },
        { min: 4, max: 5, pontos: 4 },
      ],
    },
    {
      tipo: "limiar",
      rotulo: "Fim em até 60 segundos",
      stat: "tempo_seg",
      op: "<=",
      valor: 60,
      pontos: 10,
      quando: [
        { stat: "resultado", eq: "vitoria" },
        { stat: "metodo", in: ANTES_DO_TEMPO },
      ],
    },

    // §5 — desempenho (vale para os dois lutadores, tenham vencido ou perdido)
    { tipo: "linear", rotulo: "Golpes significativos conectados", stat: "sig_conectados", fator: 0.3 },
    { tipo: "linear", rotulo: "Golpes significativos sofridos", stat: "sig_sofridos", fator: -0.1 },
    { tipo: "linear", rotulo: "Knockdowns aplicados", stat: "knockdowns", fator: 8 },
    { tipo: "linear", rotulo: "Quedas conectadas", stat: "quedas", fator: 4 },
    { tipo: "linear", rotulo: "Tentativas de finalização", stat: "tentativas_finalizacao", fator: 3 },
    { tipo: "linear", rotulo: "Reversões", stat: "reversoes", fator: 4 },
    // "a cada 2 minutos COMPLETOS; frações são descartadas" — piso, não arredondamento.
    { tipo: "bloco", rotulo: "Tempo de controle", stat: "controle_seg", bloco: 120, fator: 1 },

    // §6 — contexto
    { tipo: "flag", rotulo: "Performance of the Night", stat: "potn", pontos: 10 },
    { tipo: "flag", rotulo: "Fight of the Night", stat: "fotn", pontos: 6 },
    {
      tipo: "flag",
      rotulo: "Vitória em luta de cinturão",
      stat: "cinturao",
      pontos: 10,
      quando: [{ stat: "resultado", eq: "vitoria" }],
    },
    {
      tipo: "flag",
      rotulo: "Vitória em luta de cinturão interino",
      stat: "cinturao_interino",
      pontos: 5,
      quando: [{ stat: "resultado", eq: "vitoria" }],
    },

    // §7 — penalidades
    { tipo: "linear", rotulo: "Pontos descontados pelo árbitro", stat: "pontos_descontados", fator: -5 },
    { tipo: "flag", rotulo: "Desqualificação", stat: "desqualificado", pontos: -20 },
    { tipo: "flag", rotulo: "Não bateu o peso e a luta aconteceu", stat: "nao_bateu_peso", pontos: -8 },
    { tipo: "flag", rotulo: "Falta que gerou No Contest", stat: "falta_no_contest", pontos: -10 },
  ],

  // É esta lista que desenha o formulário de apuração — o painel admin não tem
  // uma linha de código por esporte.
  stats: [
    {
      key: "resultado",
      tipo: "cat",
      rotulo: "Resultado",
      opcoes: ["vitoria", "empate", "derrota", "no_contest"],
      ajuda: "Súmula oficial no UFC.com",
    },
    {
      key: "metodo",
      tipo: "cat",
      rotulo: "Método",
      opcoes: [
        "ko",
        "finalizacao",
        "tko_medico",
        "decisao_unanime",
        "tko_lesao",
        "dq_adversario",
        "decisao_dividida",
      ],
      ajuda: "Só pontua para o vencedor",
    },
    { key: "round_fim", tipo: "num", rotulo: "Round do fim", ajuda: "1 a 5" },
    { key: "tempo_seg", tipo: "num", rotulo: "Tempo do round (segundos)" },
    { key: "sig_conectados", tipo: "num", rotulo: "Golpes significativos conectados", ajuda: "ufcstats.com" },
    { key: "sig_sofridos", tipo: "num", rotulo: "Golpes significativos sofridos", ajuda: "ufcstats.com" },
    { key: "knockdowns", tipo: "num", rotulo: "Knockdowns aplicados" },
    { key: "quedas", tipo: "num", rotulo: "Quedas conectadas", ajuda: "Takedown convertido, não tentativa" },
    { key: "tentativas_finalizacao", tipo: "num", rotulo: "Tentativas de finalização" },
    { key: "reversoes", tipo: "num", rotulo: "Reversões" },
    { key: "controle_seg", tipo: "num", rotulo: "Tempo de controle (segundos)" },
    { key: "potn", tipo: "bool", rotulo: "Performance of the Night" },
    { key: "fotn", tipo: "bool", rotulo: "Fight of the Night" },
    { key: "cinturao", tipo: "bool", rotulo: "Luta de cinturão" },
    { key: "cinturao_interino", tipo: "bool", rotulo: "Luta de cinturão interino" },
    { key: "pontos_descontados", tipo: "num", rotulo: "Pontos descontados pelo árbitro" },
    { key: "desqualificado", tipo: "bool", rotulo: "Desqualificado" },
    { key: "nao_bateu_peso", tipo: "bool", rotulo: "Não bateu o peso (luta aconteceu)" },
    { key: "falta_no_contest", tipo: "bool", rotulo: "Cometeu a falta que gerou No Contest" },
  ],
};
