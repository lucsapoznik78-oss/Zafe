// Modo Escalação — o motor de pontuação.
//
// Puro, determinístico, zero I/O. É o único lugar do modo onde se decide quanto
// vale um desempenho; a apuração (lib/escalacao/apuracao.ts) só lê stats do banco,
// chama daqui e grava o resultado.
//
// POR QUE EM TYPESCRIPT E NÃO EM PLPGSQL: dinheiro fica em plpgsql SECURITY
// DEFINER (escalacao_inscrever / escalacao_pagar_card), porque precisa de
// atomicidade. Pontos não são dinheiro até `escalacao_pagar_card` rodar, e essa
// RPC só lê números já calculados. O que a pontuação precisa é de teste, e o
// único harness do repo é o Vitest — um interpretador de JSONB em plpgsql seria
// intestável aqui. Os manuais de UFC (§12) e surf (§14) trazem doze exemplos
// itemizados; eles são a suíte.

import type { Expr, Regra, Ruleset, StatMap, StatValue } from "./rules";

// ------------------------------------------------------------
// Entrada
// ------------------------------------------------------------
// Uma ocorrência é uma sub-unidade do evento: uma bateria de surf, uma corrida
// do fim de semana de F1, um set de tênis. `contexto` são os números que a
// fórmula lê e que não são desempenho do atleta — no surf, quantos surfistas
// entraram na bateria e quantas vagas ela dava (§2).
export interface Ocorrencia {
  ordem: number;
  stats: StatMap;
  contexto?: Record<string, number>;
}

export interface EventoStats {
  eventoKey: string;
  stats: StatMap;
  ocorrencias?: Ocorrencia[];
}

// ------------------------------------------------------------
// Saída
// ------------------------------------------------------------
// `Linha` é o que o Art. 34 exige que o usuário consiga ler: rótulo do manual,
// a conta feita e o resultado. Vai literal para `escalacao_card_atleta.detalhe`.
export interface Linha {
  rotulo: string;
  conta: string;
  pontos: number;
  ocorrencia?: number;
}

export interface ResultadoEvento {
  eventoKey: string;
  total: number;
  bruto: number;
  linhas: Linha[];
  clampado: "teto" | "piso" | null;
}

export interface ResultadoMes {
  total: number;
  porEvento: ResultadoEvento[];
}

// ------------------------------------------------------------
// Aritmética
// ------------------------------------------------------------
// ARREDONDAMENTO: uma vez por Linha, para UMA casa decimal, a partir do produto
// exato. Não é escolha estética — é o que os doze exemplos apurados dos manuais
// fazem. Prova (surf §14, exemplo B): 15,90 × 0,55 = 8,745 e o manual imprime
// 8,7. Arredondar em duas etapas (centi-pontos e depois décimos) daria 8,8 e o
// exemplo inteiro erraria. Meio para longe do zero, para que a penalidade de
// −0,1 por golpe sofrido arredonde igual ao bônus de +0,3 por golpe conectado.
function arred1(x: number): number {
  // O epsilon corrige a representação binária: 8,745 é guardado como
  // 8,744999999999999 e sem ele cairia para 8,7 por acidente de float, não por
  // regra. 1e-9 é grande o bastante para o erro de representação e pequeno
  // demais para mudar qualquer conta real do manual.
  const s = x < 0 ? -1 : 1;
  return (s * Math.round(Math.abs(x) * 10 + 1e-9)) / 10;
}

// Somatórios andam em DÉCIMOS INTEIROS. Somar 42,5 como float a partir de cinco
// parcelas de uma casa já produz 42,499999999999996.
function decimos(x: number): number {
  const s = x < 0 ? -1 : 1;
  return s * Math.round(Math.abs(x) * 10 + 1e-9);
}

function fmt(n: number): string {
  return String(Math.round(n * 10000) / 10000).replace(".", ",");
}

// ------------------------------------------------------------
// Leitura de stats
// ------------------------------------------------------------
function num(v: StatValue | undefined): number | null {
  if (typeof v === "number") return v;
  if (Array.isArray(v)) return v.reduce((a, b) => a + b, 0);
  return null;
}

function lista(v: StatValue | undefined): number[] | null {
  if (Array.isArray(v)) return v;
  if (typeof v === "number") return [v];
  return null;
}

// ------------------------------------------------------------
// Guardas
// ------------------------------------------------------------
// TODAS as condições de `quando` precisam valer. É o que permite escrever
// "bônus de round só quando VENCEU e o método foi KO ou finalização" sem um tipo
// de regra novo — e é o que faz o exemplo D do UFC (KO no round 1, mas DERROTA)
// não ganhar os +15 do round.
function passaGuardas(r: Regra, stats: StatMap): boolean {
  if (!r.quando) return true;
  for (const g of r.quando) {
    const v = stats[g.stat];
    if (v === undefined || v === null) return false;
    if (g.eq !== undefined && v !== g.eq) return false;
    if (g.ne !== undefined && v === g.ne) return false;
    if (g.in !== undefined && !g.in.includes(v as string | number)) return false;
    if (g.gte !== undefined) {
      const n = num(v);
      if (n === null || n < g.gte) return false;
    }
    if (g.lte !== undefined) {
      const n = num(v);
      if (n === null || n > g.lte) return false;
    }
  }
  return true;
}

// ------------------------------------------------------------
// Fórmulas
// ------------------------------------------------------------
// AST estruturada: sem parser, sem eval, sem superfície de injeção. O JSONB vem
// do banco e é avaliado por um switch. Stat ausente ou divisão por zero devolve
// null e a regra simplesmente não emite linha.
function avaliar(e: Expr, stats: StatMap): number | null {
  switch (e.op) {
    case "const":
      return e.v;
    case "stat":
      return num(stats[e.k]);
    default: {
      const a = avaliar(e.a, stats);
      const b = avaliar(e.b, stats);
      if (a === null || b === null) return null;
      if (e.op === "+") return a + b;
      if (e.op === "-") return a - b;
      if (e.op === "*") return a * b;
      return b === 0 ? null : a / b;
    }
  }
}

/** Renderiza a expressão com os valores já substituídos — vira o campo `conta`. */
function escreverExpr(e: Expr, stats: StatMap): string {
  switch (e.op) {
    case "const":
      return fmt(e.v);
    case "stat": {
      const n = num(stats[e.k]);
      return n === null ? e.k : fmt(n);
    }
    default:
      return `(${escreverExpr(e.a, stats)} ${e.op} ${escreverExpr(e.b, stats)})`;
  }
}

// ------------------------------------------------------------
// Aplicação de uma regra
// ------------------------------------------------------------
// Emite zero, uma ou várias linhas. Emite linha de ZERO PONTO quando o stat
// existe (ex.: UFC exemplo C — 1 minuto de controle, nenhum bloco de 2 min
// completo, +0): o usuário precisa ver que a regra foi considerada e por que
// não rendeu, senão o breakdown do Art. 34 parece ter esquecido a linha.
function aplicarRegra(r: Regra, stats: StatMap, ocorrencia?: number): Linha[] {
  if (!passaGuardas(r, stats)) return [];

  const linha = (conta: string, pontos: number): Linha[] => [
    { rotulo: r.rotulo, conta, pontos: arred1(pontos), ...(ocorrencia !== undefined ? { ocorrencia } : {}) },
  ];

  switch (r.tipo) {
    case "lookup": {
      const v = stats[r.stat];
      if (v === undefined || v === null) return [];
      const chave = String(v);
      const p = r.mapa[chave];
      if (p === undefined) return [];
      return linha(`${chave} → ${fmt(p)}`, p);
    }

    case "linear": {
      const v = num(stats[r.stat]);
      if (v === null) return [];
      const bruto = v * r.fator;
      let p = bruto;
      if (r.teto !== undefined && p > r.teto) p = r.teto;
      if (r.piso !== undefined && p < r.piso) p = r.piso;
      const nota = p !== bruto ? ` (limitado a ${fmt(p)})` : "";
      return linha(`${fmt(v)} × ${fmt(r.fator)}${nota}`, p);
    }

    case "bloco": {
      const v = num(stats[r.stat]);
      if (v === null) return [];
      const blocos = Math.floor(v / r.bloco);
      return linha(
        `piso(${fmt(v)} ÷ ${fmt(r.bloco)}) = ${blocos} × ${fmt(r.fator)}`,
        blocos * r.fator
      );
    }

    case "faixa": {
      // Uma linha POR VALOR: no surf o bônus de nota vale para as DUAS ondas do
      // somatório, e o exemplo E tem duas notas 10,00 na mesma bateria (+12 cada).
      const vs = lista(stats[r.stat]);
      if (vs === null) return [];
      const out: Linha[] = [];
      for (const v of vs) {
        const f = r.faixas.find((x) => v >= x.min && v <= x.max);
        if (!f) continue;
        out.push({
          rotulo: r.rotulo,
          conta: `${fmt(v)} ∈ [${fmt(f.min)}; ${fmt(f.max)}] → ${fmt(f.pontos)}`,
          pontos: arred1(f.pontos),
          ...(ocorrencia !== undefined ? { ocorrencia } : {}),
        });
      }
      return out;
    }

    case "limiar": {
      const v = num(stats[r.stat]);
      if (v === null) return [];
      const bate = r.op === "<=" ? v <= r.valor : v >= r.valor;
      if (!bate) return [];
      return linha(`${fmt(v)} ${r.op} ${fmt(r.valor)} → ${fmt(r.pontos)}`, r.pontos);
    }

    case "flag": {
      const v = stats[r.stat];
      if (v !== true) return [];
      return linha(`sim → ${fmt(r.pontos)}`, r.pontos);
    }

    case "formula": {
      const v = avaliar(r.expr, stats);
      if (v === null) return [];
      return linha(`${escreverExpr(r.expr, stats)} = ${fmt(v)}`, v);
    }
  }
}

// ------------------------------------------------------------
// Rollup: a mesma stat lida por ocorrência e no agregado
// ------------------------------------------------------------
// Uma stat lançada POR OCORRÊNCIA também fica visível no nível do evento, como
// a LISTA dos valores das ocorrências (`num()` soma listas). Uma stat declarada
// explicitamente em `ev.stats` sempre vence o agregado.
//
// Isto existe por causa de uma linha do manual de surf que parece detalhe e não
// é. O §3 manda multiplicar por 0,55 e o exemplo A imprime UMA linha:
//
//     Somatórios 13,10 · 14,50 · 15,17 · 16,84 · 17,60 → 77,21 × 0,55 → +42,5
//
// Ou seja: soma as cinco baterias, multiplica UMA vez, arredonda UMA vez. Sem o
// rollup, `somatorio` teria que ser lançado duas vezes — uma por bateria (para o
// bônus de bateria perfeita do §4, que é por bateria) e uma no evento (para o
// ×0,55). Dado duplicado é dado que diverge.
//
// Booleano vira 1/0, e é isso que permite ao surf §2 escrever "não avançou de
// NENHUMA bateria" como um limiar sobre a soma dos avanços, em vez de exigir do
// apurador uma segunda marcação redundante.
function statsDoEvento(ev: EventoStats): StatMap {
  if (!ev.ocorrencias?.length) return ev.stats;

  const agregado: Record<string, number[]> = {};
  for (const oc of ev.ocorrencias) {
    for (const [k, v] of Object.entries(oc.stats)) {
      if (k in ev.stats) continue;
      const vs = typeof v === "boolean" ? [v ? 1 : 0] : lista(v);
      if (vs === null) continue;
      (agregado[k] ??= []).push(...vs);
    }
  }
  return { ...agregado, ...ev.stats };
}

// ------------------------------------------------------------
// Pontuação de um evento
// ------------------------------------------------------------
/**
 * Aplica o ruleset inteiro a uma luta / etapa / GP e devolve o breakdown.
 * As regras rodam na ordem do array — é a ordem do manual, e é a ordem em que o
 * usuário lê o detalhamento.
 */
export function pontuarEvento(rs: Ruleset, ev: EventoStats): ResultadoEvento {
  const linhas: Linha[] = [];
  const doEvento = statsDoEvento(ev);

  for (const r of rs.regras) {
    if (r.porOcorrencia) {
      for (const oc of ev.ocorrencias ?? []) {
        // O contexto entra junto dos stats: para a fórmula do surf §2 não há
        // diferença entre "quantas ondas o atleta pegou" e "quantas vagas a
        // bateria dava" — as duas são entradas da mesma conta.
        const merged: StatMap = { ...ev.stats, ...oc.contexto, ...oc.stats };
        linhas.push(...aplicarRegra(r, merged, oc.ordem));
      }
    } else {
      linhas.push(...aplicarRegra(r, doEvento));
    }
  }

  const brutoDec = linhas.reduce((acc, l) => acc + decimos(l.pontos), 0);
  const bruto = brutoDec / 10;

  // Clamp sobre o AGREGADO do evento (surf §7, adotado como regra geral do modo):
  // teto +180, piso −25. Sem ele um único desempenho absurdo domina o card
  // inteiro e a calibragem de 33–36 pontos/atleta/mês deixa de valer.
  let total = bruto;
  let clampado: "teto" | "piso" | null = null;
  if (bruto > rs.tetoEvento) {
    total = rs.tetoEvento;
    clampado = "teto";
  } else if (bruto < rs.pisoEvento) {
    total = rs.pisoEvento;
    clampado = "piso";
  }

  return { eventoKey: ev.eventoKey, total, bruto, linhas, clampado };
}

// ------------------------------------------------------------
// Agregação do mês
// ------------------------------------------------------------
/**
 * UFC §9 SOMA as duas lutas do mês; surf §9 conta só o stop designado. A escolha
 * é dado (`escalacao_regra.agregacao_mes`), não `if` por esporte.
 *
 * `eventoDesignado` vem de `escalacao_card_esporte.evento_key`.
 */
export function pontuarMes(
  rs: Ruleset,
  eventos: EventoStats[],
  opts?: { eventoDesignado?: string }
): ResultadoMes {
  const porEvento = eventos.map((ev) => pontuarEvento(rs, ev));

  if (porEvento.length === 0) return { total: 0, porEvento };

  // F1 §3: média das corridas em que o piloto LARGOU. Só entram no divisor os
  // eventos que estão na lista — quem não largou num GP simplesmente não tem
  // evento ali, e a corrida sai da média (F1 §10) em vez de entrar como zero.
  if (rs.agregacaoMes === "media") {
    const soma = porEvento.reduce((acc, e) => acc + decimos(e.total), 0);
    return { total: arred1(soma / 10 / porEvento.length), porEvento };
  }

  if (rs.agregacaoMes === "melhor") {
    const total = Math.max(...porEvento.map((e) => e.total));
    return { total, porEvento };
  }

  if (rs.agregacaoMes === "designado") {
    const alvo = opts?.eventoDesignado
      ? porEvento.find((e) => e.eventoKey === opts.eventoDesignado)
      : porEvento[0];
    return { total: alvo?.total ?? 0, porEvento };
  }

  const total = porEvento.reduce((acc, e) => acc + decimos(e.total), 0) / 10;
  return { total, porEvento };
}

// ------------------------------------------------------------
// Acionamento de reserva (Art. 19 a 21)
// ------------------------------------------------------------
export interface SlotEntrada {
  id: string;
  papel: "titular" | "reserva";
  ordem: number;
  capitao?: boolean;
  /** NULL = ainda não apurado. `false` é o que aciona a reserva (Art. 19). */
  competiu: boolean | null;
  /** Pontuação do atleta no card — a mesma para todos os times (UFC §10). */
  pontos: number | null;
}

export interface SlotResultado {
  id: string;
  pontua: boolean;
  substituiuId: string | null;
  pontosAplicados: number;
}

export interface ResultadoTime {
  slots: SlotResultado[];
  total: number;
}

/**
 * Deriva quem pontua. SEMPRE do zero — nunca incremental: recalcular precisa ser
 * idempotente, senão uma correção de stat no meio da apuração deixa resíduo.
 *
 * Regras: titular que não competiu cede a vez à próxima reserva não usada, na
 * ordem que o USUÁRIO escolheu (Art. 13, 1ª e 2ª); titular excedente pontua zero
 * (Art. 20 §2); reserva não acionada pontua zero (Art. 21).
 *
 * O Art. 20 é silente sobre a reserva que também não competiu. Adoto PULAR: ela
 * é ignorada e a próxima cobre o mesmo titular. A leitura alternativa (o slot é
 * consumido) puniria o usuário por um fato fora do seu controle e esvaziaria a
 * 2ª reserva justamente no card em que ela seria mais necessária.
 */
export function aplicarReservas(
  slots: SlotEntrada[],
  opts?: { multiplicadorCapitao?: number }
): ResultadoTime {
  const mult = opts?.multiplicadorCapitao ?? 1;

  const titulares = slots.filter((s) => s.papel === "titular").sort((a, b) => a.ordem - b.ordem);
  const reservas = slots.filter((s) => s.papel === "reserva").sort((a, b) => a.ordem - b.ordem);

  const out = new Map<string, SlotResultado>();
  for (const s of slots) {
    out.set(s.id, { id: s.id, pontua: false, substituiuId: null, pontosAplicados: 0 });
  }

  const pontuar = (s: SlotEntrada, substituiuId: string | null) => {
    const base = s.pontos ?? 0;
    out.set(s.id, {
      id: s.id,
      pontua: true,
      substituiuId,
      pontosAplicados: s.capitao ? base * mult : base,
    });
  };

  let i = 0;
  for (const t of titulares) {
    if (t.competiu === false) {
      // Consome a próxima reserva que efetivamente competiu.
      while (i < reservas.length && reservas[i].competiu === false) i++;
      if (i < reservas.length) pontuar(reservas[i++], t.id);
      continue;
    }
    pontuar(t, null);
  }

  const total =
    Array.from(out.values()).reduce((acc, r) => acc + Math.round(r.pontosAplicados * 100), 0) / 100;

  return { slots: Array.from(out.values()), total };
}
