import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import {
  ITENS,
  ITENS_INICIAIS,
  ITENS_POR_SLOT,
  POR_ID,
  ROTULO_SLOT,
  precoDe,
  precoPorId,
} from "../catalogo";
import { PRECO, RARIDADES, SLOTS } from "../tipos";

// `require` de propósito: o entrypoint ESM do lucide puxa ~1500 módulos e o
// build CJS resolve a lista de nomes num arquivo só.
const ICONES = Object.keys(createRequire(import.meta.url)("lucide-react"));

describe("catálogo", () => {
  it("não tem id repetido", () => {
    // Um id duplicado passa despercebido na tela (a grade mostra os dois) mas
    // quebra o inventário: a PK é (user_id, item_id), então comprar o segundo
    // devolve `ja_possui` sem cobrar e sem entregar.
    expect(POR_ID.size).toBe(ITENS.length);
  });

  it("todo item tem slot e raridade conhecidos", () => {
    for (const it of ITENS) {
      expect(SLOTS, it.id).toContain(it.slot);
      expect(RARIDADES, it.id).toContain(it.raridade);
    }
  });

  it("todo item tem nome, forma e pelo menos uma cor", () => {
    for (const it of ITENS) {
      expect(it.nome.length, it.id).toBeGreaterThan(0);
      expect(it.forma.length, it.id).toBeGreaterThan(0);
      expect(it.cores.length, it.id).toBeGreaterThan(0);
      expect(it.icone.length, it.id).toBeGreaterThan(0);
    }
  });

  it("id cabe no limite de 64 do figura_comprar", () => {
    // A RPC rejeita item com length > 64. Um id maior seria invendável em
    // produção e só apareceria no primeiro clique de compra.
    for (const it of ITENS) expect(it.id.length, it.id).toBeLessThanOrEqual(64);
  });

  it("todo slot tem pelo menos um item", () => {
    for (const slot of SLOTS) {
      expect(ITENS_POR_SLOT[slot]?.length ?? 0, slot).toBeGreaterThan(0);
      expect(ROTULO_SLOT[slot], slot).toBeTruthy();
    }
  });

  it("o índice por slot concorda com o slot de cada item", () => {
    for (const slot of SLOTS) {
      for (const it of ITENS_POR_SLOT[slot]) expect(it.slot).toBe(slot);
    }
  });

  it("preço é 0 exatamente para os itens iniciais", () => {
    for (const it of ITENS) {
      expect(precoDe(it), it.id).toBe(it.inicial ? 0 : PRECO[it.raridade]);
    }
    expect(ITENS.filter((i) => precoDe(i) === 0).map((i) => i.id).sort()).toEqual(
      [...ITENS_INICIAIS].sort(),
    );
  });

  it("os iniciais cobrem os três slots que deixariam o personagem pelado", () => {
    const slots = ITENS_INICIAIS.map((id) => POR_ID.get(id)!.slot);
    expect(new Set(slots)).toEqual(new Set(["torso", "pernas", "pes"]));
  });

  it("precoPorId devolve null para id que não existe", () => {
    expect(precoPorId("nao-existe")).toBeNull();
    expect(precoPorId("coroa")).toBe(PRECO.epico);
  });

  it("preço fica dentro da faixa aceita pela RPC", () => {
    for (const it of ITENS) {
      const p = precoDe(it);
      expect(p, it.id).toBeGreaterThanOrEqual(0);
      expect(p, it.id).toBeLessThanOrEqual(100000);
    }
  });

  it("todo ícone existe no lucide", () => {
    // Nome de ícone é string solta: `Icons[it.icone]` com nome errado devolve
    // `undefined` e o React estoura só quando alguém abre aquela aba da loja.
    // O type-check não pega. Este teste pega.
    for (const it of ITENS) expect(ICONES, `${it.id} → ${it.icone}`).toContain(it.icone);
  });

  it("duasMaos só existe em item de mão direita", () => {
    // A exclusão em `sanearFigura` só olha maoDir. Um `duasMaos` em outro slot
    // seria silenciosamente ignorado.
    for (const it of ITENS) {
      if (it.duasMaos) expect(it.slot, it.id).toBe("maoDir");
    }
  });

  it("escondeCabelo só existe em chapéu", () => {
    for (const it of ITENS) {
      if (it.escondeCabelo) expect(it.slot, it.id).toBe("chapeu");
    }
  });
});
