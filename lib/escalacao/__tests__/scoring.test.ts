// Os nove manuais de 7/ago/2026 são tabelas de uma página. Não trazem exemplos
// apurados, então os casos abaixo são derivados linha a linha das tabelas — e
// existem para travar as DUAS decisões de leitura que os documentos deixam
// implícitas, que são justamente onde um erro vira Z$ emitido a mais:
//
//   1. linha marcada "(bonus)" SOMA; linhas não marcadas da mesma dimensão são
//      EXCLUSIVAS entre si. "Vitória +30" e "Vitória por nocaute +50" são o
//      mesmo desfecho, então um nocaute vale 50 — não 80.
//   2. as fases de surf/tênis (quartas, semi, vice, campeão) são um degrau só,
//      o mais alto alcançado. Somar as quatro pagaria +215 de bônus a um campeão.
//
// Os pontos são Z$ diretos: +30 aqui é +30 Z$ na carteira do usuário.

import { describe, expect, it } from "vitest";
import { aplicarReservas, pontuarEvento, pontuarMes, type EventoStats } from "../scoring";
import { RULESETS } from "../rulesets";
import {
  boxeV1,
  f1V1,
  futebolV1,
  nbaV1,
  nflV1,
  surfV1,
  tenisV1,
  ufcV1,
  valorantV1,
} from "../rulesets";
import { parseRuleset } from "../rules";
import type { Ruleset, StatMap } from "../rules";

function total(rs: Ruleset, stats: StatMap): number {
  return pontuarEvento(rs, { eventoKey: "t", stats }).total;
}

// ------------------------------------------------------------
// UFC e boxe
// ------------------------------------------------------------
describe("UFC v1", () => {
  it("vitória por decisão → +30", () => {
    expect(total(ufcV1, { resultado: "vitoria" })).toBe(30);
  });

  it("vitória por nocaute → +50, NÃO 80", () => {
    expect(total(ufcV1, { resultado: "vitoria_ko" })).toBe(50);
  });

  it("vitória por finalização → +50", () => {
    expect(total(ufcV1, { resultado: "vitoria_finalizacao" })).toBe(50);
  });

  it("nocaute em luta de cinturão → 50 + 20 de bônus = +70", () => {
    expect(total(ufcV1, { resultado: "vitoria_ko", cinturao: true })).toBe(70);
  });

  it("derrota por nocaute → −20 (e não −30)", () => {
    expect(total(ufcV1, { resultado: "derrota_ko" })).toBe(-20);
  });

  it("no contest → 0", () => {
    expect(total(ufcV1, { resultado: "no_contest" })).toBe(0);
  });

  it("duas lutas no mês SOMAM", () => {
    const eventos: EventoStats[] = [
      { eventoKey: "ufc-330", stats: { resultado: "vitoria_ko" } },
      { eventoKey: "ufc-fn-22", stats: { resultado: "derrota" } },
    ];
    expect(pontuarMes(ufcV1, eventos).total).toBe(40);
  });
});

describe("Boxe v1", () => {
  it("é o UFC sem finalização", () => {
    expect(total(boxeV1, { resultado: "vitoria_ko", cinturao: true })).toBe(70);
    expect(total(boxeV1, { resultado: "derrota" })).toBe(-10);
    expect(boxeV1.stats.find((s) => s.key === "resultado")!.opcoes).not.toContain(
      "vitoria_finalizacao"
    );
  });
});

// ------------------------------------------------------------
// Fórmula 1
// ------------------------------------------------------------
describe("Fórmula 1 v1", () => {
  it("vitória com pole → 50 + 10 = +60", () => {
    expect(total(f1V1, { resultado: "vitoria", pole: true })).toBe(60);
  });

  it("pódio → +30 · top 10 → +15 · classificado → +5 · abandono → −10", () => {
    expect(total(f1V1, { resultado: "podio" })).toBe(30);
    expect(total(f1V1, { resultado: "top10" })).toBe(15);
    expect(total(f1V1, { resultado: "classificado" })).toBe(5);
    expect(total(f1V1, { resultado: "abandono" })).toBe(-10);
  });

  it("o mês é a MÉDIA das corridas, não a soma", () => {
    // Sem isso, novembro (4 GPs) valeria 4× dezembro (1 GP) e ninguém escalaria
    // piloto fora do mês cheio.
    const eventos: EventoStats[] = [
      { eventoKey: "gp-1", stats: { resultado: "vitoria" } }, // 50
      { eventoKey: "gp-2", stats: { resultado: "abandono" } }, // −10
    ];
    expect(pontuarMes(f1V1, eventos).total).toBe(20);
  });
});

// ------------------------------------------------------------
// Surf e tênis — os gêmeos de progressão em chave
// ------------------------------------------------------------
describe("Surf v1", () => {
  it("campeão do stop: entrou 5 + 5 baterias × 15 + campeão 90 = +170", () => {
    expect(
      total(surfV1, { entrou_chave: true, baterias_vencidas: 5, fase: "campeao" })
    ).toBe(170);
  });

  it("as fases NÃO se acumulam — o campeão leva 90, não 25+40+60+90", () => {
    const campeao = total(surfV1, { entrou_chave: true, baterias_vencidas: 0, fase: "campeao" });
    expect(campeao).toBe(95);
  });

  it("eliminado na primeira bateria: 5 − 5 = 0", () => {
    expect(
      total(surfV1, {
        entrou_chave: true,
        baterias_vencidas: 0,
        fase: "nenhuma",
        eliminado_primeira: true,
      })
    ).toBe(0);
  });

  it("semifinalista: 5 + 4×15 + 40 = +105", () => {
    expect(
      total(surfV1, { entrou_chave: true, baterias_vencidas: 4, fase: "semifinal" })
    ).toBe(105);
  });

  it("só o stop DESIGNADO conta no mês", () => {
    const eventos: EventoStats[] = [
      { eventoKey: "wsl-stop9", stats: { entrou_chave: true, baterias_vencidas: 5, fase: "campeao" } },
      { eventoKey: "wsl-stop10", stats: { entrou_chave: true, baterias_vencidas: 0, fase: "nenhuma" } },
    ];
    expect(pontuarMes(surfV1, eventos, { eventoDesignado: "wsl-stop9" }).total).toBe(170);
    expect(pontuarMes(surfV1, eventos, { eventoDesignado: "wsl-stop10" }).total).toBe(5);
  });
});

describe("Tênis v1", () => {
  it("mesma tabela do surf, rodada no lugar de bateria", () => {
    expect(
      total(tenisV1, { entrou_chave: true, rodadas_vencidas: 5, fase: "campeao" })
    ).toBe(170);
    expect(
      total(tenisV1, { entrou_chave: true, rodadas_vencidas: 0, eliminado_primeira: true })
    ).toBe(0);
  });
});

// ------------------------------------------------------------
// Futebol
// ------------------------------------------------------------
describe("Futebol v1", () => {
  it("atacante marca 2 e o time vence: 50+50+30 = +130", () => {
    expect(total(futebolV1, { resultado: "vitoria", gols: 2 })).toBe(130);
  });

  it("goleiro sem sofrer gol na vitória: 30 + 20 = +50", () => {
    expect(total(futebolV1, { resultado: "vitoria", sem_sofrer_gol: true })).toBe(50);
  });

  it("expulso na derrota: −10 − 20 = −30", () => {
    expect(total(futebolV1, { resultado: "derrota", cartao_vermelho: true })).toBe(-30);
  });

  it("gol contra no empate: 10 − 20 = −10", () => {
    expect(total(futebolV1, { resultado: "empate", gols_contra: 1 })).toBe(-10);
  });

  it("assistência é bônus e soma: empate + 1 assistência = +35", () => {
    expect(total(futebolV1, { resultado: "empate", assistencias: 1 })).toBe(35);
  });

  it("não relacionado → 0", () => {
    expect(total(futebolV1, { resultado: "nao_jogou" })).toBe(0);
  });
});

// ------------------------------------------------------------
// NBA, NFL, Valorant
// ------------------------------------------------------------
describe("NBA v1", () => {
  it("triple-double na vitória com MVP: 30 + 50 + 20 = +100", () => {
    expect(total(nbaV1, { resultado: "vitoria", duplo: "triple_double", mvp: true })).toBe(100);
  });

  it("triple-double NÃO paga também o double-double", () => {
    // Todo triple-double é um double-double. Somar os dois pagaria +70 por uma
    // coisa só.
    expect(total(nbaV1, { resultado: "derrota", duplo: "triple_double" })).toBe(40);
    expect(total(nbaV1, { resultado: "derrota", duplo: "double_double" })).toBe(10);
  });

  it("não jogou → 0", () => {
    expect(total(nbaV1, { resultado: "nao_jogou", duplo: "nenhum" })).toBe(0);
  });
});

describe("NFL v1", () => {
  it("2 touchdowns na vitória: 30 + 100 = +130", () => {
    expect(total(nflV1, { resultado: "vitoria", touchdowns: 2 })).toBe(130);
  });

  it("QB: 3 passes para TD e 1 interceptação na vitória: 30 + 60 − 20 = +70", () => {
    expect(total(nflV1, { resultado: "vitoria", passes_td: 3, turnovers: 1 })).toBe(70);
  });

  it("kicker com 2 field goals na derrota: −10 + 20 = +10", () => {
    expect(total(nflV1, { resultado: "derrota", jogadas_decisivas: 2 })).toBe(10);
  });
});

describe("Valorant v1", () => {
  it("MVP com ace e clutch na vitória: 30 + 50 + 20 + 15 = +115", () => {
    expect(total(valorantV1, { resultado: "vitoria", mvp: true, aces: 1, clutches: 1 })).toBe(115);
  });

  it("reserva que não jogou → 0", () => {
    expect(total(valorantV1, { resultado: "nao_jogou" })).toBe(0);
  });
});

// ------------------------------------------------------------
// Sem clamp
// ------------------------------------------------------------
describe("os manuais simplificados não têm teto nem piso por evento", () => {
  it("um campeão de stop não é cortado", () => {
    const r = pontuarEvento(surfV1, {
      eventoKey: "t",
      stats: { entrou_chave: true, baterias_vencidas: 5, fase: "campeao" },
    });
    expect(r.clampado).toBeNull();
    expect(r.total).toBe(r.bruto);
  });

  it("a proteção da economia é o disjuntor por card, não o clamp por evento", () => {
    // `escalacao_card.teto_emissao_z` recusa o pagamento INTEIRO se a emissão
    // estourar o limite declarado na abertura. É o que transforma um bug de
    // pontuação em alerta em vez de moeda emitida.
    for (const rs of Object.values(RULESETS)) {
      expect(rs.tetoEvento).toBeGreaterThanOrEqual(9999);
      expect(rs.pisoEvento).toBeLessThanOrEqual(-9999);
    }
  });
});

// ------------------------------------------------------------
// Acionamento de reserva (Art. 19 a 21)
// ------------------------------------------------------------
describe("aplicarReservas", () => {
  const t = (n: number, competiu: boolean | null, pontos: number) => ({
    id: `t${n}`,
    papel: "titular" as const,
    ordem: n,
    competiu,
    pontos,
  });
  const r = (n: number, competiu: boolean | null, pontos: number) => ({
    id: `r${n}`,
    papel: "reserva" as const,
    ordem: n,
    competiu,
    pontos,
  });

  it("titular que competiu pontua; reserva no banco não pontua", () => {
    const out = aplicarReservas([t(1, true, 40), t(2, true, 10), r(1, true, 99)]);
    expect(out.total).toBe(50);
    expect(out.slots.find((s) => s.id === "r1")!.pontua).toBe(false);
  });

  it("titular que não competiu cede a vez à 1ª reserva", () => {
    const out = aplicarReservas([t(1, false, 0), t(2, true, 10), r(1, true, 30), r(2, true, 20)]);
    expect(out.total).toBe(40);
    const acionada = out.slots.find((s) => s.id === "r1")!;
    expect(acionada.pontua).toBe(true);
    expect(acionada.substituiuId).toBe("t1");
    expect(out.slots.find((s) => s.id === "r2")!.pontua).toBe(false);
  });

  it("reserva que também não competiu é PULADA, não consome o slot", () => {
    // O Art. 20 é silente. A leitura alternativa — o slot é consumido — puniria
    // o usuário por um fato fora do seu controle e esvaziaria a 2ª reserva
    // justamente no card em que ela seria mais necessária.
    const out = aplicarReservas([t(1, false, 0), r(1, false, 0), r(2, true, 25)]);
    expect(out.total).toBe(25);
    expect(out.slots.find((s) => s.id === "r2")!.substituiuId).toBe("t1");
  });

  it("mais ausências do que reservas: os titulares excedentes valem zero (Art. 20 §2)", () => {
    const out = aplicarReservas([t(1, false, 0), t(2, false, 0), r(1, true, 30)]);
    expect(out.total).toBe(30);
    expect(out.slots.find((s) => s.id === "t2")!.pontua).toBe(false);
  });

  it("é idempotente — recalcular não acumula", () => {
    const slots = [t(1, false, 0), t(2, true, 10), r(1, true, 30)];
    expect(aplicarReservas(slots).total).toBe(aplicarReservas(slots).total);
  });

  it("multiplicador de capitão desligado (=1) não altera nada", () => {
    const base = [{ ...t(1, true, 40), capitao: true }, t(2, true, 10)];
    expect(aplicarReservas(base).total).toBe(50);
    expect(aplicarReservas(base, { multiplicadorCapitao: 2 }).total).toBe(90);
  });
});

// ------------------------------------------------------------
// Os nove rulesets são válidos contra o schema
// ------------------------------------------------------------
describe("rulesets publicados", () => {
  const todos = Object.entries(RULESETS);

  it("são nove — um por manual", () => {
    expect(todos).toHaveLength(9);
  });

  it.each(todos)("%s passa no schema zod (é o que o banco vai validar)", (_nome, rs) => {
    expect(() => parseRuleset(JSON.parse(JSON.stringify(rs)))).not.toThrow();
  });

  it.each(todos)("%s: toda regra referencia um stat declarado", (_nome, rs) => {
    const declarados = new Set(rs.stats.map((s) => s.key));
    const usados: string[] = [];
    const daExpr = (e: unknown): void => {
      const x = e as { op: string; k?: string; a?: unknown; b?: unknown };
      if (x.op === "stat" && x.k) usados.push(x.k);
      if (x.a) daExpr(x.a);
      if (x.b) daExpr(x.b);
    };
    for (const r of rs.regras) {
      if ("stat" in r) usados.push(r.stat);
      if (r.tipo === "formula") daExpr(r.expr);
      for (const g of r.quando ?? []) usados.push(g.stat);
    }
    // Sem isto, uma regra com stat_key errada fica silenciosamente valendo zero
    // para sempre: o motor pula o que não encontra, e o formulário do admin
    // (gerado a partir de `stats`) nunca oferece o campo para preencher.
    expect([...new Set(usados)].filter((k) => !declarados.has(k))).toEqual([]);
  });

  it.each(todos)("%s: todo valor de lookup está entre as opções do stat", (_nome, rs) => {
    for (const r of rs.regras) {
      if (r.tipo !== "lookup") continue;
      const decl = rs.stats.find((s) => s.key === r.stat)!;
      const opcoes = new Set(decl.opcoes ?? []);
      // Chave do mapa que não é opção do select nunca seria alcançada pelo
      // apurador — a regra existiria e jamais pontuaria.
      expect(Object.keys(r.mapa).filter((k) => !opcoes.has(k))).toEqual([]);
    }
  });
});
