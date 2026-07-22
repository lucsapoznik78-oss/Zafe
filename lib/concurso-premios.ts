/**
 * Cálculo da premiação do Concurso Mensal.
 *
 * Dois regimes, escolhidos pelo número de inscritos no ranking final:
 *
 * — Menos de PERCENTUAL_MIN_INSCRITOS (300): tabela fixa do jsonb
 *   `concursos.premios` (ex.: 8.000 / 5.000 / 3.000 / 4º–5º 2.000).
 *
 * — 300+ inscritos: percentuais sobre `premiacao_total`:
 *     1º ............................ 30%
 *     2º ............................  5%
 *     3º até top 1% (P1) ............ 45% divididos igualmente
 *     P1+1 até top 2% (P2) .......... 20% divididos igualmente
 *   onde P1 = ceil(N × 0,01) e P2 = ceil(N × 0,02).
 *
 * Empates (mesmo saldo ZC$ = mesma posição, competition ranking):
 * — Posições de valor individual (1º/2º e a tabela fixa): o grupo empatado
 *   divide igualmente a soma dos prêmios das posições que ocupa.
 * — Empate inteiramente dentro de uma faixa (45% ou 20%): sem efeito,
 *   a faixa já é divisão igual.
 * — Empate cruzando a fronteira 45%→20% (ex.: empatados do 99º ao 103º com
 *   P1 = 100): a faixa de 45% se estende até o último empatado — todos do
 *   3º ao 103º dividem os 45% — e a faixa de 20% passa a começar depois
 *   dele, até P2.
 * — Empate cruzando o corte final (P2): a faixa de 20% se estende até o
 *   último empatado.
 *
 * A soma dos prêmios é sempre exatamente a premiação total (restos de
 * arredondamento em centavos são distribuídos aos primeiros de cada faixa).
 */

export const PERCENTUAL_MIN_INSCRITOS = 300;

export const FAIXAS_PERCENTUAIS = {
  primeiro: 0.30,
  segundo: 0.05,
  restoTop1: 0.45,
  restoTop2: 0.20,
} as const;

export type PremioFixo =
  | { posicao: number; valor: number }
  | { posicao_de: number; posicao_ate: number; valor: number };

export interface RankingEntry {
  user_id: string;
  balance: number;
}

export interface PremioCalculado {
  user_id: string;
  posicao: number;
  valorCentavos: number;
}

function premioFixoParaPosicao(premios: PremioFixo[], posicao: number): number {
  for (const p of premios) {
    if ("posicao" in p && p.posicao === posicao) return p.valor;
    if ("posicao_de" in p && posicao >= p.posicao_de && posicao <= p.posicao_ate) return p.valor;
  }
  return 0;
}

interface Grupo {
  posicao: number; // posição do primeiro do grupo (competition ranking)
  userIds: string[];
}

/** Agrupa o ranking por saldo (empates) com competition ranking (1,2,2,4…). */
function agruparPorSaldo(ranking: RankingEntry[]): Grupo[] {
  const ordenado = [...ranking].sort((a, b) => Number(b.balance) - Number(a.balance));
  const grupos: Grupo[] = [];
  let ultimoSaldo: number | null = null;
  let pos = 1;
  for (const entry of ordenado) {
    const saldo = Number(entry.balance);
    if (ultimoSaldo !== null && saldo === ultimoSaldo) {
      grupos[grupos.length - 1].userIds.push(entry.user_id);
    } else {
      grupos.push({ posicao: pos, userIds: [entry.user_id] });
      ultimoSaldo = saldo;
    }
    pos++;
  }
  return grupos;
}

/** Divide `totalCentavos` igualmente entre os membros (resto de centavos aos primeiros). */
function dividirIgual(membros: { user_id: string; posicao: number }[], totalCentavos: number): PremioCalculado[] {
  const n = membros.length;
  if (n === 0 || totalCentavos <= 0) return [];
  const base = Math.floor(totalCentavos / n);
  let resto = totalCentavos - base * n;
  return membros.map((m) => {
    const extra = resto > 0 ? 1 : 0;
    if (resto > 0) resto--;
    return { user_id: m.user_id, posicao: m.posicao, valorCentavos: base + extra };
  });
}

/** Membros de um grupo, todos com a posição do grupo (empate = mesma posição). */
function membrosDoGrupo(g: Grupo): { user_id: string; posicao: number }[] {
  return g.userIds.map((user_id) => ({ user_id, posicao: g.posicao }));
}

function calcularRegimeFixo(premios: PremioFixo[], grupos: Grupo[]): PremioCalculado[] {
  const resultado: PremioCalculado[] = [];
  for (const g of grupos) {
    // Soma dos prêmios das posições ocupadas pelo grupo empatado
    let somaCentavos = 0;
    for (let i = 0; i < g.userIds.length; i++) {
      somaCentavos += Math.round(premioFixoParaPosicao(premios, g.posicao + i) * 100);
    }
    if (somaCentavos > 0) resultado.push(...dividirIgual(membrosDoGrupo(g), somaCentavos));
  }
  return resultado;
}

function calcularRegimePercentual(
  premiacaoTotal: number,
  grupos: Grupo[],
  totalInscritos: number
): PremioCalculado[] {
  const totalCentavos = Math.round(premiacaoTotal * 100);
  const vPrimeiro = Math.round(totalCentavos * FAIXAS_PERCENTUAIS.primeiro);
  const vSegundo = Math.round(totalCentavos * FAIXAS_PERCENTUAIS.segundo);
  const vFaixa1 = Math.round(totalCentavos * FAIXAS_PERCENTUAIS.restoTop1); // 3º..P1
  const vFaixa2 = totalCentavos - vPrimeiro - vSegundo - vFaixa1; // P1+1..P2 (fecha a conta)

  const P1 = Math.ceil(totalInscritos * 0.01);
  const P2 = Math.ceil(totalInscritos * 0.02);

  const resultado: PremioCalculado[] = [];
  const faixa1: { user_id: string; posicao: number }[] = [];
  const faixa2: { user_id: string; posicao: number }[] = [];

  // Fim efetivo da faixa de 45%: estende até o último empatado se um grupo cruza P1
  let fimFaixa1 = P1;
  // Fim efetivo da faixa de 20%: estende até o último empatado se um grupo cruza P2
  let fimFaixa2 = P2;
  for (const g of grupos) {
    const fim = g.posicao + g.userIds.length - 1;
    if (g.posicao <= P1 && fim > P1) fimFaixa1 = fim;
    if (g.posicao <= P2 && fim > P2) fimFaixa2 = fim;
  }
  if (fimFaixa2 < fimFaixa1) fimFaixa2 = fimFaixa1;

  for (const g of grupos) {
    if (g.posicao > fimFaixa2) break;
    const fim = g.posicao + g.userIds.length - 1;

    if (g.posicao <= 2) {
      // Grupo toca 1º/2º: divide a soma dos prêmios individuais que ocupa.
      let soma = 0;
      for (let p = g.posicao; p <= Math.min(fim, 2); p++) {
        soma += p === 1 ? vPrimeiro : vSegundo;
      }
      resultado.push(...dividirIgual(membrosDoGrupo(g), soma));
      continue;
    }

    if (g.posicao <= fimFaixa1) faixa1.push(...membrosDoGrupo(g));
    else faixa2.push(...membrosDoGrupo(g));
  }

  // Caso extremo: um empate gigante engoliu a faixa de 20% inteira
  // (fimFaixa1 >= fimFaixa2). O valor da faixa 2 se soma à faixa 1
  // para conservar a premiação total.
  if (faixa2.length === 0) {
    resultado.push(...dividirIgual(faixa1, vFaixa1 + vFaixa2));
  } else {
    resultado.push(...dividirIgual(faixa1, vFaixa1));
    resultado.push(...dividirIgual(faixa2, vFaixa2));
  }

  return resultado;
}

/**
 * Calcula os prêmios em centavos por usuário a partir do ranking final.
 * `ranking` não precisa vir ordenado; posições são recalculadas a partir
 * do saldo ZC$ (empate = mesma posição).
 */
export function calcularPremiacao(
  premiacaoTotal: number,
  premiosFixos: PremioFixo[] | null,
  ranking: RankingEntry[]
): PremioCalculado[] {
  if (!ranking.length) return [];
  const grupos = agruparPorSaldo(ranking);

  if (ranking.length < PERCENTUAL_MIN_INSCRITOS) {
    return calcularRegimeFixo(premiosFixos ?? [], grupos);
  }
  return calcularRegimePercentual(premiacaoTotal, grupos, ranking.length);
}
