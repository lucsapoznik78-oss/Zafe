// Os manuais entregaram os próprios testes de aceite.
//
// Cada um dos quatro documentos publicados termina com uma seção de "exemplos
// apurados", itemizada linha a linha e com o total impresso. São 24 casos, e
// eles cobrem a faixa inteira das tabelas — do −10,1 de uma derrota rápida ao
// 176,5 de um título de stop.
//
// O motor está certo quando os 24 reproduzem no décimo. Não é tolerância: é
// igualdade exata. Se um destes falhar, o breakdown que o Art. 34 obriga a
// mostrar ao usuário vai divergir do manual que o regulamento manda seguir —
// e isso é exposição jurídica, não bug de arredondamento.

import { describe, expect, it } from "vitest";
import { aplicarReservas, pontuarEvento, pontuarMes, type EventoStats } from "../scoring";
import { boxeV1, f1V1, surfV1, ufcV1 } from "../rulesets";
import { parseRuleset } from "../rules";
import type { Ruleset } from "../rules";

function total(rs: Ruleset, ev: Omit<EventoStats, "eventoKey">): number {
  return pontuarEvento(rs, { eventoKey: "t", ...ev }).total;
}

// ------------------------------------------------------------
// UFC §12
// ------------------------------------------------------------
describe("UFC v1 — os seis exemplos apurados do §12", () => {
  it("A · nocaute no 1º round com Performance of the Night → 86,3", () => {
    expect(
      total(ufcV1, {
        stats: {
          resultado: "vitoria",
          metodo: "ko",
          round_fim: 1,
          sig_conectados: 14,
          sig_sofridos: 9,
          knockdowns: 1,
          potn: true,
        },
      })
    ).toBe(86.3);
  });

  it("B · finalização no 2º round, domínio no solo → 80,8", () => {
    // 6min20 de controle = 380s → 3 blocos COMPLETOS de 2 min, não 3,17.
    expect(
      total(ufcV1, {
        stats: {
          resultado: "vitoria",
          metodo: "finalizacao",
          round_fim: 2,
          sig_conectados: 22,
          sig_sofridos: 18,
          quedas: 3,
          tentativas_finalizacao: 2,
          controle_seg: 380,
        },
      })
    ).toBe(80.8);
  });

  it("C · decisão unânime numa guerra de 3 rounds, com Fight of the Night → 70,7", () => {
    expect(
      total(ufcV1, {
        stats: {
          resultado: "vitoria",
          metodo: "decisao_unanime",
          round_fim: 3,
          sig_conectados: 96,
          sig_sofridos: 81,
          knockdowns: 1,
          quedas: 1,
          controle_seg: 60,
          fotn: true,
        },
      })
    ).toBe(70.7);
  });

  it("C · o minuto de controle aparece no breakdown valendo zero", () => {
    // O manual imprime "1min de controle · 0 bloco completo · 0". A linha de
    // zero ponto não é ruído: sem ela o usuário acha que a regra foi esquecida.
    const r = pontuarEvento(ufcV1, {
      eventoKey: "t",
      stats: { resultado: "vitoria", metodo: "decisao_unanime", controle_seg: 60 },
    });
    const l = r.linhas.find((x) => x.rotulo === "Tempo de controle");
    expect(l).toBeDefined();
    expect(l!.pontos).toBe(0);
  });

  it("D · derrota por nocaute no 1º round → −10,1", () => {
    // O caso que prova por que `quando` precisa ser uma LISTA: o lutador perdeu
    // por KO no round 1 e NÃO leva nem o bônus de método nem o de velocidade.
    expect(
      total(ufcV1, {
        stats: {
          resultado: "derrota",
          metodo: "ko",
          round_fim: 1,
          tempo_seg: 90,
          sig_conectados: 5,
          sig_sofridos: 16,
        },
      })
    ).toBe(-10.1);
  });

  it("E · derrota por decisão dividida numa luta boa → 22,5", () => {
    expect(
      total(ufcV1, {
        stats: {
          resultado: "derrota",
          metodo: "decisao_dividida",
          sig_conectados: 71,
          sig_sofridos: 78,
          quedas: 2,
          tentativas_finalizacao: 1,
          controle_seg: 240,
          fotn: true,
        },
      })
    ).toBe(22.5);
  });

  it("F · nocaute em 22 segundos em luta de cinturão → 104,1", () => {
    expect(
      total(ufcV1, {
        stats: {
          resultado: "vitoria",
          metodo: "ko",
          round_fim: 1,
          tempo_seg: 22,
          cinturao: true,
          sig_conectados: 4,
          sig_sofridos: 1,
          knockdowns: 1,
          potn: true,
        },
      })
    ).toBe(104.1);
  });

  it("§9 — duas lutas no mesmo mês somam", () => {
    const luta = { stats: { resultado: "vitoria", metodo: "decisao_unanime" } };
    const r = pontuarMes(ufcV1, [
      { eventoKey: "ufc-331", ...luta },
      { eventoKey: "ufc-332", ...luta },
    ]);
    expect(r.total).toBe(64);
  });
});

// ------------------------------------------------------------
// Surf §14
// ------------------------------------------------------------
// A unidade de ocorrência é a bateria. As notas das ondas foram escolhidas para
// somar exatamente os somatórios que o manual imprime e conter exatamente os
// bônus de nota que ele lista.
describe("Surf v1 — os seis exemplos apurados do §14", () => {
  const bateria = (ordem: number, ondas: number[], avancou: boolean, extra = {}) => ({
    ordem,
    contexto: { surfistas: 2, vagas: 1 },
    stats: {
      avancou,
      somatorio: Math.round(ondas.reduce((a, b) => a + b, 0) * 100) / 100,
      ondas,
      ...extra,
    },
  });

  it("A · campeão do stop, cinco baterias vencidas → 176,5", () => {
    // 77,21 × 0,55 = 42,4655 → 42,5. Uma multiplicação, um arredondamento.
    expect(
      total(surfV1, {
        stats: { entrou_agua: true, colocacao: "campeao" },
        ocorrencias: [
          bateria(1, [7.0, 6.1], true),   // 13,10
          bateria(2, [8.2, 6.3], true),   // 14,50 · 8
          bateria(3, [8.17, 7.0], true),  // 15,17 · 8
          bateria(4, [9.0, 7.84], true),  // 16,84 · 9
          bateria(5, [9.6, 8.0], true),   // 17,60 · 9 · 8
        ],
      })
    ).toBe(176.5);
  });

  it("B · semifinalista → 89,9", () => {
    expect(
      total(surfV1, {
        stats: { entrou_agua: true, colocacao: "semifinal" },
        ocorrencias: [
          bateria(1, [6.5, 5.5], true),   // 12,00
          bateria(2, [7.0, 6.4], true),   // 13,40
          bateria(3, [8.74, 7.16], true), // 15,90 · 8
          bateria(4, [6.0, 5.2], false),  // 11,20
        ],
      })
    ).toBe(89.9);
  });

  it("C · onda 10 na estreia, eliminado nas oitavas → 44,9", () => {
    expect(
      total(surfV1, {
        stats: { entrou_agua: true, colocacao: "outros" },
        ocorrencias: [
          bateria(1, [10.0, 7.5], true),  // 17,50 · 10
          bateria(2, [5.0, 4.6], false),  // 9,60
        ],
      })
    ).toBe(44.9);
  });

  it("D · eliminado na primeira bateria → 2,9", () => {
    // O −8 do §2 sai de um limiar sobre a SOMA dos avanços das baterias, que o
    // rollup do motor produz a partir dos booleanos. Não há campo redundante.
    expect(
      total(surfV1, {
        stats: { entrou_agua: true },
        ocorrencias: [bateria(1, [4.9, 4.0], false)], // 8,90
      })
    ).toBe(2.9);
  });

  it("E · bateria perfeita nas quartas, perdeu a semifinal → 142,7", () => {
    // Duas notas 10,00 na MESMA bateria: +12 cada, e ainda o +25 de somatório
    // 20,00 por cima. É o caso que obriga o stat a poder ser uma LISTA.
    expect(
      total(surfV1, {
        stats: { entrou_agua: true, colocacao: "semifinal" },
        ocorrencias: [
          bateria(1, [7.0, 5.4], true),    // 12,40
          bateria(2, [8.2, 5.8], true),    // 14,00 · 8
          bateria(3, [10.0, 10.0], true),  // 20,00 · 10 · 10 · perfeita
          bateria(4, [7.1, 6.0], false),   // 13,10
        ],
      })
    ).toBe(142.7);
  });

  it("F · interferência e eliminação nas oitavas → 19,3", () => {
    expect(
      total(surfV1, {
        stats: { entrou_agua: true },
        ocorrencias: [
          bateria(1, [7.6, 6.6], true),                          // 14,20
          bateria(2, [3.4, 3.0], false, { interferencia: true }), // 6,40
        ],
      })
    ).toBe(19.3);
  });

  it("§2 — a fórmula de avanço lê o formato da bateria, não uma tabela", () => {
    const um = (surfistas: number, vagas: number) =>
      pontuarEvento(surfV1, {
        eventoKey: "t",
        stats: {},
        ocorrencias: [{ ordem: 1, contexto: { surfistas, vagas }, stats: { avancou: true } }],
      }).total;
    expect(um(2, 1)).toBe(12);
    expect(um(3, 1)).toBe(18);
    expect(um(3, 2)).toBe(9);
    expect(um(4, 2)).toBe(12);
  });

  it("§9 — só o stop designado conta no mês", () => {
    const stop = (k: string, colocacao: string) => ({
      eventoKey: k,
      stats: { entrou_agua: true, colocacao },
    });
    const r = pontuarMes(surfV1, [stop("wsl-stop8", "campeao"), stop("wsl-stop9", "quartas")], {
      eventoDesignado: "wsl-stop9",
    });
    expect(r.total).toBe(14); // 6 + 8, e não os 46 do stop que não foi designado
  });
});

// ------------------------------------------------------------
// F1 §13
// ------------------------------------------------------------
describe("Fórmula 1 v1 — os sete exemplos apurados do §13", () => {
  it("A · pole, vitória e volta mais rápida → 92", () => {
    expect(
      total(f1V1, {
        stats: {
          pole: true,
          q3: true,
          completou: true,
          posicao: 1,
          posicoes_ganhas: 0,
          volta_rapida: true,
          venceu_duelo_corrida: true,
          venceu_duelo_quali: true,
        },
      })
    ).toBe(92);
  });

  it("B · recuperação: largou em 16º, terminou em 7º → 69", () => {
    expect(
      total(f1V1, {
        stats: {
          q3: false,
          completou: true,
          posicao: 7,
          posicoes_ganhas: 9,
          venceu_duelo_corrida: true,
          venceu_duelo_quali: true,
        },
      })
    ).toBe(69);
  });

  it("C · largou em 3º e abandonou → 4", () => {
    expect(
      total(f1V1, {
        stats: {
          q3: true,
          nao_classificado: true,
          venceu_duelo_corrida: false,
          venceu_duelo_quali: true,
        },
      })
    ).toBe(4);
  });

  it("D · fundo de grid: largou em 19º, terminou em 14º → 48", () => {
    // Doze vezes o piloto de ponta do exemplo C. Não é ruído — é o duelo com o
    // companheiro fazendo as vinte vagas do grid continuarem escaláveis.
    expect(
      total(f1V1, {
        stats: {
          q3: false,
          completou: true,
          posicao: 14,
          posicoes_ganhas: 5,
          venceu_duelo_corrida: true,
          venceu_duelo_quali: true,
        },
      })
    ).toBe(48);
  });

  it("E · largou em 2º, terminou em 5º com penalidade de tempo → 27", () => {
    expect(
      total(f1V1, {
        stats: {
          q3: true,
          completou: true,
          posicao: 5,
          posicoes_perdidas: 3,
          penalidades_tempo: 1,
          venceu_duelo_corrida: false,
          venceu_duelo_quali: true,
        },
      })
    ).toBe(27);
  });

  it("F · fim de semana com sprint: 2º no sprint, venceu o GP saindo do 4º → 91", () => {
    expect(
      total(f1V1, {
        stats: {
          q3: true,
          sprint_pos: 2,
          completou: true,
          posicao: 1,
          posicoes_ganhas: 3,
          venceu_duelo_corrida: true,
          venceu_duelo_quali: true,
        },
      })
    ).toBe(91);
  });

  it("G · a média de novembro, o mês de quatro GPs → 41,0", () => {
    // 164 ÷ 4. É a decisão estrutural do manual de F1: sem a média, um piloto
    // escalado em novembro (4 GPs) valeria quatro vezes um de dezembro (1 GP).
    const mexico: EventoStats = {
      eventoKey: "gp-mexico", // 5º → 48
      stats: {
        q3: true,
        completou: true,
        posicao: 5,
        posicoes_ganhas: 1,
        venceu_duelo_corrida: true,
      },
    };
    const interlagos: EventoStats = {
      eventoKey: "gp-sao-paulo", // abandono → 12
      stats: { nao_classificado: true, venceu_duelo_corrida: true, venceu_duelo_quali: true },
    };
    const lasVegas: EventoStats = {
      eventoKey: "gp-las-vegas", // vitória → 71
      stats: {
        q3: true,
        completou: true,
        posicao: 1,
        posicoes_ganhas: 2,
        venceu_duelo_corrida: true,
      },
    };
    const catar: EventoStats = {
      eventoKey: "gp-catar", // 9º → 33
      stats: {
        q3: true,
        completou: true,
        posicao: 9,
        posicoes_perdidas: 1,
        venceu_duelo_corrida: true,
      },
    };

    const corridas = [mexico, interlagos, lasVegas, catar];
    expect(corridas.map((c) => pontuarEvento(f1V1, c).total)).toEqual([48, 12, 71, 33]);
    expect(pontuarMes(f1V1, corridas).total).toBe(41); // 164 ÷ 4
  });

  it("§5 — o teto de +30 nas posições ganhas", () => {
    // Um piloto que larga em último por penalidade de motor e recupera 15
    // posições leva 30, não 45: informação pública com semanas de antecedência
    // não pode render mais que vencer a corrida.
    const r = pontuarEvento(f1V1, { eventoKey: "t", stats: { posicoes_ganhas: 15 } });
    expect(r.total).toBe(30);
  });

  it("§7 — a volta mais rápida só conta no top 10", () => {
    const fora = total(f1V1, { stats: { completou: true, posicao: 11, volta_rapida: true } });
    const dentro = total(f1V1, { stats: { completou: true, posicao: 10, volta_rapida: true } });
    expect(fora).toBe(11);    // 5 + 6, sem os 7
    expect(dentro).toBe(20);  // 5 + 8 + 7
  });
});

// ------------------------------------------------------------
// Boxe §13
// ------------------------------------------------------------
describe("Boxe v1 — os seis exemplos apurados do §13", () => {
  it("A · nocaute no 2º round numa luta de cinturão → 105,2", () => {
    expect(
      total(boxeV1, {
        stats: {
          resultado: "vitoria",
          metodo: "ko",
          round_fim: 2,
          knockdowns: 2,
          golpes_conectados: 44,
          golpes_sofridos: 16,
          cinturao: true,
          potn: true,
        },
      })
    ).toBe(105.2);
  });

  it("B · decisão unânime numa luta técnica de 12 rounds → 79,8", () => {
    expect(
      total(boxeV1, {
        stats: {
          resultado: "vitoria",
          metodo: "decisao_unanime",
          knockdowns: 1,
          golpes_conectados: 204,
          golpes_sofridos: 108,
          fotn: true,
        },
      })
    ).toBe(79.8);
  });

  it("C · nocaute em 48 segundos → 80,6", () => {
    // 4 × −0,065 = −0,26 → −0,3. Meio para LONGE do zero: a penalidade
    // arredonda com o mesmo critério do bônus.
    expect(
      total(boxeV1, {
        stats: {
          resultado: "vitoria",
          metodo: "ko",
          round_fim: 1,
          tempo_seg: 48,
          knockdowns: 1,
          golpes_conectados: 9,
          golpes_sofridos: 4,
        },
      })
    ).toBe(80.6);
  });

  it("D · derrota por nocaute no 3º round, dois knockdowns sofridos → −10,1", () => {
    expect(
      total(boxeV1, {
        stats: {
          resultado: "derrota",
          metodo: "ko",
          round_fim: 3,
          knockdowns_sofridos: 2,
          golpes_conectados: 24,
          golpes_sofridos: 48,
        },
      })
    ).toBe(-10.1);
  });

  it("E · derrota numa guerra de 12 rounds, com Fight of the Night → 25,1", () => {
    expect(
      total(boxeV1, {
        stats: {
          resultado: "derrota",
          metodo: "decisao_unanime",
          knockdowns: 1,
          golpes_conectados: 156,
          golpes_sofridos: 180,
          fotn: true,
        },
      })
    ).toBe(25.1);
  });

  it("F · vitória por decisão dividida apertada em 10 rounds → 49,4", () => {
    expect(
      total(boxeV1, {
        stats: {
          resultado: "vitoria",
          metodo: "decisao_dividida",
          golpes_conectados: 150,
          golpes_sofridos: 140,
        },
      })
    ).toBe(49.4);
  });
});

// ------------------------------------------------------------
// Teto e piso do evento
// ------------------------------------------------------------
describe("clamp do evento (surf §7, regra geral do modo)", () => {
  it("teto de +180", () => {
    const r = pontuarEvento(surfV1, {
      eventoKey: "t",
      stats: { entrou_agua: true, colocacao: "campeao" },
      ocorrencias: Array.from({ length: 8 }, (_, i) => ({
        ordem: i + 1,
        contexto: { surfistas: 3, vagas: 1 },
        stats: { avancou: true, somatorio: 20, ondas: [10, 10] },
      })),
    });
    expect(r.bruto).toBeGreaterThan(180);
    expect(r.total).toBe(180);
    expect(r.clampado).toBe("teto");
  });

  it("piso de −25", () => {
    const r = pontuarEvento(ufcV1, {
      eventoKey: "t",
      stats: {
        resultado: "derrota",
        desqualificado: true,
        nao_bateu_peso: true,
        pontos_descontados: 2,
        sig_sofridos: 40,
      },
    });
    expect(r.bruto).toBeLessThan(-25);
    expect(r.total).toBe(-25);
    expect(r.clampado).toBe("piso");
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
// Os rulesets são válidos contra o schema
// ------------------------------------------------------------
describe("rulesets publicados", () => {
  it.each([
    ["ufc.v1", ufcV1],
    ["surf.v1", surfV1],
    ["f1.v1", f1V1],
    ["boxe.v1", boxeV1],
  ])("%s passa no schema zod (é o que o banco vai validar)", (_nome, rs) => {
    expect(() => parseRuleset(JSON.parse(JSON.stringify(rs)))).not.toThrow();
  });

  it.each([
    ["ufc.v1", ufcV1],
    ["surf.v1", surfV1],
    ["f1.v1", f1V1],
    ["boxe.v1", boxeV1],
  ])("%s: toda regra referencia um stat declarado", (_nome, rs) => {
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

  it("o alvo de calibragem dos quatro manuais cai na faixa de 33 a 36 (UFC §11)", () => {
    for (const rs of [ufcV1, surfV1, f1V1, boxeV1]) {
      expect(rs.evAlvo).toBeGreaterThanOrEqual(33);
      expect(rs.evAlvo).toBeLessThanOrEqual(36);
    }
  });
});
