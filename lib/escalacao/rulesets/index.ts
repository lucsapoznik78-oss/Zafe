import type { Ruleset } from "../rules";
import { boxeV1 } from "./boxe.v1";
import { f1V1 } from "./f1.v1";
import { futebolV1 } from "./futebol.v1";
import { futebolV2 } from "./futebol.v2";
import { nbaV1 } from "./nba.v1";
import { nbaV2 } from "./nba.v2";
import { nflV1 } from "./nfl.v1";
import { nflV2 } from "./nfl.v2";
import { surfV1 } from "./surf.v1";
import { tenisV1 } from "./tenis.v1";
import { ufcV1 } from "./ufc.v1";
import { valorantV1 } from "./valorant.v1";
import { valorantV2 } from "./valorant.v2";

// Registro dos rulesets transcritos dos manuais. NÃO é a fonte da verdade em
// produção — quem manda é `escalacao_regra` no banco, que é versionado e
// imutável depois de publicado (Art. 24 § único). Este registro existe para o
// seed (scripts/seed-escalacao-regras.mts) e para os testes.
//
// Os nove manuais de 7/ago/2026 pontuam DIRETO EM Z$: o que o manual chama de
// "+30 pontos" é +30 Z$ na carteira. Por isso todo card usa `pontos_por_z = 1`.
export const RULESETS: Record<string, Ruleset> = {
  "ufc.v1": ufcV1,
  "boxe.v1": boxeV1,
  "f1.v1": f1V1,
  "surf.v1": surfV1,
  "tenis.v1": tenisV1,
  "futebol.v1": futebolV1,
  "nba.v1": nbaV1,
  "nfl.v1": nflV1,
  "valorant.v1": valorantV1,
  // v2 dos quatro esportes de liga: mesma estrutura, escala por evento dividida.
  // No modo fixo o time pontua no mês inteiro, e a escala dos manuais (escrita
  // por partida) emitia várias vezes a entrada. Ver `futebol.v2.ts`.
  "futebol.v2": futebolV2,
  "nba.v2": nbaV2,
  "nfl.v2": nflV2,
  "valorant.v2": valorantV2,
};

/**
 * Quantos eventos um atleta acumula num mês, por esporte. É o número que
 * transforma a escala por partida do manual no total que o modo realmente emite
 * — e a razão de os quatro esportes de liga precisarem de uma v2.
 *
 * Os do mix não aparecem porque não somam: F1 tira média, surf e tênis contam só
 * o evento designado, e UFC/boxe têm no máximo uma luta no mês.
 */
export const EVENTOS_POR_MES: Record<string, number> = {
  futebol: 4, // rodadas do Brasileirão
  nfl: 4, // uma partida por semana
  nba: 13, // o calendário mais denso das quatro
  valorant: 4, // séries de fase de liga do VCT
};

export {
  boxeV1,
  f1V1,
  futebolV1,
  futebolV2,
  nbaV1,
  nbaV2,
  nflV1,
  nflV2,
  surfV1,
  tenisV1,
  ufcV1,
  valorantV1,
  valorantV2,
};
