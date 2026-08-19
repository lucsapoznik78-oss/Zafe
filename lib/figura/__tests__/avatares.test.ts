import { describe, expect, it } from "vitest";

import { AVATARES, AVATAR_POR_ID, PRECO_AVATAR, POSES, precoAvatar } from "../avatares";
import { ITENS, POR_ID } from "../catalogo";
import { PELES } from "../paletas";

describe("catálogo do cast", () => {
  it("tem os 30 personagens, todos com id único", () => {
    expect(AVATARES).toHaveLength(30);
    expect(AVATAR_POR_ID.size).toBe(AVATARES.length);
  });

  it("nenhum id do cast colide com um id de acessório", () => {
    // A rota de compra resolve "acessório, senão avatar" numa tabela só. Um id
    // nos dois catálogos venderia o item errado pelo preço do outro.
    for (const a of AVATARES) expect(POR_ID.has(a.id)).toBe(false);
    for (const it of ITENS) expect(AVATAR_POR_ID.has(it.id)).toBe(false);
  });

  it("todo id do cast começa com `av-` — é o que separa os dois namespaces", () => {
    for (const a of AVATARES) expect(a.id.startsWith("av-")).toBe(true);
  });

  it("pose e tom de pele existem de verdade", () => {
    for (const a of AVATARES) {
      expect(POSES).toContain(a.pose);
      expect(a.pele).toBeGreaterThanOrEqual(0);
      expect(a.pele).toBeLessThan(PELES.length);
    }
  });

  it("o preço sai da raridade, e nenhum é zero", () => {
    for (const a of AVATARES) {
      expect(precoAvatar(a)).toBe(PRECO_AVATAR[a.raridade]);
      expect(precoAvatar(a)).toBeGreaterThan(0);
    }
  });

  it("prop de duas mãos não vem com a esquerda ocupada no catálogo", () => {
    for (const a of AVATARES) {
      if (a.maoDir?.duasMaos) expect(a.maoEsq).toBeUndefined();
    }
  });
});
