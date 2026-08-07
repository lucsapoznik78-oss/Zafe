// Surf · versão 1 — transcrição do manual `Modo_convocacao/zafe-surf.docx` (6/ago/2026).
//
// É o manual que mais força a arquitetura do modo: traz a única fórmula que lê
// contexto (§2), o único bônus que se aplica por ocorrência dentro do evento
// (§4) e o teto de +180 que o próprio documento propõe como regra geral (§7).
//
// A unidade de OCORRÊNCIA aqui é a bateria.

import type { Ruleset } from "../rules";

export const surfV1: Ruleset = {
  esporte: "surf",
  versao: 1,
  tetoEvento: 180,
  pisoEvento: -25,
  // §9: um stop designado por mês. Agosto e outubro têm duas janelas abrindo e
  // exigem a designação explícita em `escalacao_card_esporte.evento_key`.
  agregacaoMes: "designado",
  evAlvo: 33.7, // §10, draw masculino

  regras: [
    // §2 — participação
    { tipo: "flag", rotulo: "Entrou na água", stat: "entrou_agua", pontos: 6 },

    // §2 — avanço de bateria. A ÚNICA regra do modo que lê números que não são
    // desempenho do atleta: quantos surfistas a bateria tinha e quantas vagas
    // ela dava. Bateria de 2 com 1 vaga = +12; de 3 com 1 = +18; de 3 com 2 =
    // +9; de 4 com 2 = +12. Uma fórmula em vez de uma tabela porque a WSL muda
    // o formato de chave entre temporadas (§10 traz a recalibragem).
    {
      tipo: "formula",
      rotulo: "Bateria avançada",
      porOcorrencia: true,
      quando: [{ stat: "avancou", eq: true }],
      expr: {
        op: "/",
        a: { op: "*", a: { op: "const", v: 6 }, b: { op: "stat", k: "surfistas" } },
        b: { op: "stat", k: "vagas" },
      },
    },

    // §2 — a penalidade de quem cai na estreia. Lê o AGREGADO de `avancou`: o
    // rollup do motor transforma os booleanos das baterias em 1/0, então "não
    // avançou de nenhuma" é um limiar sobre a soma. Sem isso o apurador teria
    // que marcar um segundo campo redundante — e dado duplicado diverge.
    {
      tipo: "limiar",
      rotulo: "Não avançou de nenhuma bateria",
      stat: "avancou",
      op: "<=",
      valor: 0,
      pontos: -8,
    },

    // §3 — o somatório das duas melhores ondas de cada bateria, ×0,55.
    // NÃO é por ocorrência: o §14 imprime uma única linha somando as baterias
    // ("77,21 × 0,55 → +42,5"), e é essa conta que o usuário vê. O motor lê o
    // agregado das baterias por rollup.
    { tipo: "linear", rotulo: "Somatório das baterias", stat: "somatorio", fator: 0.55 },

    // §4 — bônus de nota, só para as duas ondas que compõem o somatório.
    {
      tipo: "faixa",
      rotulo: "Bônus de nota",
      stat: "ondas",
      porOcorrencia: true,
      faixas: [
        { min: 8, max: 8.99, pontos: 4 },
        { min: 9, max: 9.99, pontos: 8 },
        { min: 10, max: 10, pontos: 12 },
      ],
    },
    {
      tipo: "limiar",
      rotulo: "Bateria perfeita (somatório 20,00)",
      stat: "somatorio",
      op: ">=",
      valor: 20,
      pontos: 25,
      porOcorrencia: true,
    },

    // §5 — colocação no stop
    {
      tipo: "lookup",
      rotulo: "Colocação no stop",
      stat: "colocacao",
      mapa: { campeao: 40, vice: 25, semifinal: 15, quartas: 8, outros: 0 },
    },

    // §6 — interferência, por bateria
    { tipo: "flag", rotulo: "Interferência", stat: "interferencia", pontos: -10, porOcorrencia: true },
  ],

  stats: [
    { key: "entrou_agua", tipo: "bool", rotulo: "Entrou na água" },
    {
      key: "colocacao",
      tipo: "cat",
      rotulo: "Colocação no stop",
      opcoes: ["campeao", "vice", "semifinal", "quartas", "outros"],
    },
    { key: "avancou", tipo: "bool", rotulo: "Avançou da bateria", porOcorrencia: true },
    {
      key: "surfistas",
      tipo: "num",
      rotulo: "Surfistas na bateria",
      porOcorrencia: true,
      ajuda: "Contexto da chave, não desempenho",
    },
    { key: "vagas", tipo: "num", rotulo: "Vagas de avanço", porOcorrencia: true },
    { key: "somatorio", tipo: "num", rotulo: "Somatório da bateria", porOcorrencia: true, ajuda: "0 a 20" },
    {
      key: "ondas",
      tipo: "lista",
      rotulo: "Notas das duas ondas do somatório",
      porOcorrencia: true,
      ajuda: "Só as duas que compõem o somatório — as demais não influenciam o resultado",
    },
    { key: "interferencia", tipo: "bool", rotulo: "Interferência", porOcorrencia: true },
  ],
};
