// Quanto Z$ o modo fixo emite por time, por mês.
//
// Este teste existe porque a v1 dos quatro esportes de liga estava errada em
// ordem de grandeza e nada no código dizia isso. Os manuais foram escritos por
// PARTIDA; o modo fixo trava o time antes da primeira rodada e soma o mês
// inteiro. Com a v1, um time de Brasileirão emitia ~880 Z$ contra 200 de
// entrada, e um de NFL passava de 1.500 — para todo mundo, não só para quem
// escalou bem.
//
// A conta é declarativa de propósito: as frequências abaixo são a única parte
// discutível, e ficam aqui como números nomeados em vez de escondidas num
// comentário do ruleset. Quem discordar de "0,12 gol por jogador por jogo" muda
// a linha, roda o teste e vê o efeito no total emitido.
//
// Não é simulação nem prova: é a esperança matemática de um atleta MEDIANO do
// pool. A dispersão real (quem escala bem faz mais) fica por fora — o ponto do
// teste é que o piso da emissão não seja um múltiplo da entrada.

import { describe, expect, it } from "vitest";

import { pontuarEvento } from "../scoring";
import type { Ruleset, StatMap } from "../rules";
import {
  EVENTOS_POR_MES,
  futebolV1,
  futebolV2,
  nbaV1,
  nbaV2,
  nflV1,
  nflV2,
  valorantV1,
  valorantV2,
} from "../rulesets";

/**
 * Uma distribuição de stats: cada entrada é `[stats do evento, probabilidade]`.
 * O EV do evento é a média ponderada da pontuação de cada cenário.
 */
type Cenarios = Array<[StatMap, number]>;

function evPorEvento(rs: Ruleset, cenarios: Cenarios): number {
  const p = cenarios.reduce((acc, [, prob]) => acc + prob, 0);
  expect(p).toBeCloseTo(1, 6); // a distribuição precisa fechar em 1
  return cenarios.reduce(
    (acc, [stats, prob]) => acc + pontuarEvento(rs, { eventoKey: "ev", stats }).total * prob,
    0
  );
}

function evPorTime(rs: Ruleset, cenarios: Cenarios, titulares: number): number {
  return evPorEvento(rs, cenarios) * EVENTOS_POR_MES[rs.esporte] * titulares;
}

// ------------------------------------------------------------
// As frequências. Estimativas de liga, não medições.
// ------------------------------------------------------------

/**
 * Futebol — titular médio do Brasileirão, por rodada.
 *
 * Resultado segue a distribuição da liga (≈36,5% vitória / 27% empate / 36,5%
 * derrota, somando os dois lados de cada jogo). Gol e assistência são a taxa da
 * liga dividida pelos 22 em campo. "Sem sofrer gol" só vale para GOL/ZAG, que
 * são 5 dos 11 slots do 4-3-3 — por isso a probabilidade já vem diluída.
 */
const FUTEBOL: Cenarios = [
  [{ resultado: "vitoria", gols: 1 }, 0.044],
  [{ resultado: "vitoria", assistencias: 1 }, 0.033],
  [{ resultado: "vitoria", sem_sofrer_gol: true }, 0.06],
  [{ resultado: "vitoria" }, 0.228],
  [{ resultado: "empate", gols: 1 }, 0.032],
  [{ resultado: "empate", sem_sofrer_gol: true }, 0.04],
  [{ resultado: "empate" }, 0.198],
  [{ resultado: "derrota", gols: 1 }, 0.044],
  [{ resultado: "derrota", assistencias: 1 }, 0.024],
  [{ resultado: "derrota", cartao_vermelho: true }, 0.012],
  [{ resultado: "derrota", gols_contra: 1 }, 0.005],
  [{ resultado: "derrota" }, 0.23],
  [{ resultado: "nao_jogou" }, 0.05],
];

/**
 * NFL — média sobre os 11 slots, que incluem QB, K e defesa.
 *
 * Touchdown corrido/recebido só acontece nos slots de skill (RB/WR/TE), passe
 * para TD só no QB, field goal só no K, defesa decisiva só na DEF — cada
 * probabilidade abaixo já é a do slot MÉDIO, não a do especialista.
 */
const NFL: Cenarios = [
  [{ resultado: "vitoria", touchdowns: 1 }, 0.11],
  [{ resultado: "vitoria", passes_td: 1 }, 0.05],
  [{ resultado: "vitoria", jogadas_decisivas: 1 }, 0.14],
  [{ resultado: "vitoria" }, 0.19],
  [{ resultado: "derrota", touchdowns: 1 }, 0.09],
  [{ resultado: "derrota", passes_td: 1 }, 0.04],
  [{ resultado: "derrota", jogadas_decisivas: 1 }, 0.11],
  [{ resultado: "derrota", turnovers: 1 }, 0.12],
  [{ resultado: "derrota" }, 0.11],
  [{ resultado: "nao_jogou" }, 0.04],
];

/**
 * NBA — titular do pool (que é composto de estrelas, não de reservas), por jogo.
 *
 * Duplo-duplo em ~22% dos jogos e triplo-duplo em ~3% refletem o perfil de quem
 * entra num pool de 30 nomes; um titular qualquer da liga faria menos.
 */
const NBA: Cenarios = [
  [{ resultado: "vitoria", duplo: "triple_double" }, 0.02],
  [{ resultado: "vitoria", duplo: "double_double", mvp: true }, 0.03],
  [{ resultado: "vitoria", duplo: "double_double" }, 0.07],
  [{ resultado: "vitoria", mvp: true }, 0.06],
  [{ resultado: "vitoria" }, 0.29],
  [{ resultado: "derrota", duplo: "triple_double" }, 0.01],
  [{ resultado: "derrota", duplo: "double_double" }, 0.09],
  [{ resultado: "derrota" }, 0.37],
  [{ resultado: "nao_jogou" }, 0.06],
];

/**
 * Valorant — jogador de line titular do VCT, por série.
 *
 * O MVP é um entre os dez em quadra. Clutches são frequentes (quase um por
 * série) e por isso são a linha que mais precisou cair da v1 para a v2: a 15
 * cada, sozinhos valiam metade da pontuação do jogador.
 */
const VALORANT: Cenarios = [
  [{ resultado: "vitoria", mvp: true, clutches: 2 }, 0.05],
  [{ resultado: "vitoria", clutches: 1, aces: 1 }, 0.07],
  [{ resultado: "vitoria", clutches: 1 }, 0.18],
  [{ resultado: "vitoria" }, 0.16],
  [{ resultado: "derrota", clutches: 1 }, 0.2],
  [{ resultado: "derrota", aces: 1 }, 0.04],
  [{ resultado: "derrota" }, 0.24],
  [{ resultado: "nao_jogou" }, 0.06],
];

const CASOS = [
  { nome: "Brasileirão", v1: futebolV1, v2: futebolV2, cen: FUTEBOL, titulares: 11 },
  { nome: "NFL", v1: nflV1, v2: nflV2, cen: NFL, titulares: 11 },
  { nome: "NBA", v1: nbaV1, v2: nbaV2, cen: NBA, titulares: 5 },
  { nome: "Valorant", v1: valorantV1, v2: valorantV2, cen: VALORANT, titulares: 5 },
];

const ENTRADA_Z = 200;

describe("calibragem do modo fixo", () => {
  // A trava principal. O time médio recebe de volta perto do que pagou; a
  // diferença entre times é o prêmio da escalação, não um saque garantido.
  it.each(CASOS)(
    "$nome: um time médio emite entre 150 e 250 Z$ no mês",
    ({ v2, cen, titulares }) => {
      const emitido = evPorTime(v2, cen, titulares);
      expect(emitido).toBeGreaterThan(150);
      expect(emitido).toBeLessThan(250);
    }
  );

  // O que motivou a v2: registra a distorção em vez de deixá-la implícita.
  it.each(CASOS)(
    "$nome: a v1 emitia mais que o dobro da entrada e a v2 corrige",
    ({ v1, v2, cen, titulares }) => {
      expect(evPorTime(v1, cen, titulares)).toBeGreaterThan(2 * ENTRADA_Z);
      expect(evPorTime(v2, cen, titulares)).toBeLessThan(1.25 * ENTRADA_Z);
    }
  );

  it.each(CASOS)("$nome: o EV por atleta bate com o evAlvo declarado", ({ v2, cen }) => {
    const porAtletaNoMes = evPorEvento(v2, cen) * EVENTOS_POR_MES[v2.esporte];
    expect(v2.evAlvo).toBeDefined();
    expect(porAtletaNoMes).toBeGreaterThan(v2.evAlvo! * 0.75);
    expect(porAtletaNoMes).toBeLessThan(v2.evAlvo! * 1.25);
  });

  // A queixa concreta que originou a mudança: "se ele fizer 3 gols num mês ele
  // sozinho faz 150 e paga o time". Um atleta não pode devolver a entrada sozinho.
  it("nenhum atleta paga a entrada sozinho com uma grande atuação", () => {
    const hatTrick = pontuarEvento(futebolV2, {
      eventoKey: "r1",
      stats: { resultado: "vitoria", gols: 3, assistencias: 1 },
    }).total;
    expect(hatTrick).toBeLessThan(ENTRADA_Z / 4);

    const qbMonstro = pontuarEvento(nflV2, {
      eventoKey: "s1",
      stats: { resultado: "vitoria", passes_td: 4, touchdowns: 1 },
    }).total;
    expect(qbMonstro).toBeLessThan(ENTRADA_Z / 4);
  });

  // A v2 mudou a ESCALA, não o julgamento: cada esporte é a v1 dividida por um
  // fator único, então um gol continua valendo 1,67 vitória e um clutch continua
  // valendo meio MVP. É o que garante que a recalibragem não reabriu, de
  // contrabando, a discussão sobre o que vale mais que o quê nos manuais.
  const FATOR: Record<string, number> = { futebol: 5, nfl: 5, nba: 5, valorant: 2.5 };

  it.each(CASOS)("$nome: a v2 é a v1 dividida por um fator único", ({ v1, v2, cen }) => {
    const fator = FATOR[v2.esporte];
    for (const [stats] of cen) {
      const a = pontuarEvento(v1, { eventoKey: "x", stats }).total;
      const b = pontuarEvento(v2, { eventoKey: "x", stats }).total;
      expect(b).toBeCloseTo(a / fator, 5);
    }
  });
});
