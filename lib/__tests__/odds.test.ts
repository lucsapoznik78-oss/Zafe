/**
 * Testes do cálculo parimutuel de probabilidades (lib/odds.ts):
 * odds = pool_total / pool_do_lado, 100% do pool para vencedores.
 */
import { describe, it, expect } from "vitest";
import { calcOdds, formatOdds } from "@/lib/odds";

describe("calcOdds", () => {
  it("pool vazio → 2.00x para ambos os lados", () => {
    expect(calcOdds(0, 0)).toEqual({ simOdds: 2.0, naoOdds: 2.0 });
  });

  it("pools iguais → 2.00x para ambos", () => {
    expect(calcOdds(100, 100)).toEqual({ simOdds: 2.0, naoOdds: 2.0 });
  });

  it("pool desigual → total/lado com 2 casas", () => {
    // total 400: sim = 400/100 = 4.00, nao = 400/300 = 1.33
    expect(calcOdds(100, 300)).toEqual({ simOdds: 4.0, naoOdds: 1.33 });
  });

  it("lado sem volume → 999 para o vazio, 1.00 para o cheio", () => {
    expect(calcOdds(100, 0)).toEqual({ simOdds: 1.0, naoOdds: 999.0 });
    expect(calcOdds(0, 100)).toEqual({ simOdds: 999.0, naoOdds: 1.0 });
  });

  it("limita odds em 999 mesmo com pool extremo", () => {
    const { naoOdds } = calcOdds(1_000_000, 0.01);
    expect(naoOdds).toBe(999);
  });

  it("conservação: 1/simOdds + 1/naoOdds = 1 (sem comissão)", () => {
    const cases: [number, number][] = [
      [100, 300],
      [250, 250],
      [1, 999],
      [7.5, 42.25],
    ];
    for (const [sim, nao] of cases) {
      const { simOdds, naoOdds } = calcOdds(sim, nao);
      // Probabilidades implícitas somam 100% — nenhuma fatia da plataforma
      expect(1 / simOdds + 1 / naoOdds).toBeCloseTo(1, 1);
    }
  });
});

describe("formatOdds", () => {
  it("formata com 2 casas e sufixo x", () => {
    expect(formatOdds(2)).toBe("2.00x");
    expect(formatOdds(1.333)).toBe("1.33x");
  });
});
