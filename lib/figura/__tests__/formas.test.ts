// A costura entre o catálogo (servidor) e a geometria (cliente) é uma STRING:
// `item.forma`. Nada no TypeScript liga as duas pontas, então um item cuja
// forma foi renomeada num refactor continua compilando, continua vendável e
// simplesmente não aparece no personagem de quem pagou por ele.
//
// Este teste é a única coisa que impede isso.

import { describe, expect, it } from "vitest";

import { ITENS } from "../catalogo";
import { FORMAS } from "@/components/figura3d/itens";

describe("catálogo × geometria", () => {
  it("toda forma do catálogo tem geometria", () => {
    const semGeometria = ITENS.filter((i) => !FORMAS[i.forma]).map((i) => `${i.id} → ${i.forma}`);
    expect(semGeometria).toEqual([]);
  });

  it("nenhuma geometria ficou órfã", () => {
    // Geometria sem item é código morto que ninguém consegue ver no app.
    const usadas = new Set(ITENS.map((i) => i.forma));
    expect(Object.keys(FORMAS).filter((f) => !usadas.has(f))).toEqual([]);
  });
});
