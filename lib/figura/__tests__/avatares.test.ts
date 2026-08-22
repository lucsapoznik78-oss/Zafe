import { describe, expect, it } from "vitest";

import { AVATARES, AVATAR_POR_ID, PARES, PRECO_AVATAR, POSES, precoAvatar } from "../avatares";
import { ITENS, POR_ID } from "../catalogo";
import { PELES } from "../paletas";

describe("catálogo do cast", () => {
  it("tem os personagens do cast, todos com id único", () => {
    // 22/08/26: os 11 comuns procedurais que sobrepunham a leva Hyper3D do kit
    // foram removidos — sobrou o Entregador Relâmpago e o resto do cast
    // (incomum, raro, épico, lendário). Total: 19.
    expect(AVATARES).toHaveLength(19);
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

describe("o card não pode prometer o que o modelo não desenha", () => {
  it("prop que é par aparece nas DUAS mãos, e nunca marcado como duasMaos", () => {
    // Luva de goleiro marcada `duasMaos` apagava a mão esquerda e entregava um
    // goleiro de uma luva só, com a descrição falando em "luvas". A flag quer
    // dizer "um objeto ocupa os dois lados", que é o oposto de "vem aos pares".
    for (const a of AVATARES) {
      for (const p of [a.maoDir, a.maoEsq]) {
        if (p && PARES.has(p.tipo)) expect(p.duasMaos).toBeFalsy();
      }
      const tipos = [a.maoDir?.tipo, a.maoEsq?.tipo];
      for (const t of tipos) {
        if (t && PARES.has(t)) expect(tipos.filter((x) => x === t)).toHaveLength(2);
      }
    }
  });

  it("prop que exige posição de mão só existe na pose que a produz", () => {
    // Rádio na coxa não é rádio. Se um destes ganhar outra pose, ou a pose
    // muda ou a descrição está mentindo — não há terceira saída.
    const EXIGE: Record<string, readonly string[]> = {
      radio: ["ouvido"],
      luneta: ["mirar"],
    };
    for (const a of AVATARES) {
      for (const p of [a.maoDir, a.maoEsq]) {
        const poses = p && EXIGE[p.tipo];
        if (poses) expect(poses).toContain(a.pose);
      }
    }
  });

  it("nenhuma pose carrega mais de um quinto do cast", () => {
    // Teste da silhueta, na versão que dá para automatizar: dois avatares na
    // mesma pose com a mesma altura têm o mesmo contorno, e a 64px a cor não
    // salva. `idle` chegou a levar 4 dos 30 e a fileira lia como um boneco só.
    const contagem = new Map<string, number>();
    for (const a of AVATARES) contagem.set(a.pose, (contagem.get(a.pose) ?? 0) + 1);
    const teto = Math.ceil(AVATARES.length / 5);
    for (const [pose, n] of contagem) {
      expect(n, `pose "${pose}" repete ${n}x`).toBeLessThanOrEqual(teto);
    }
  });

  it("toda pose declarada tem uso — pose órfã é código morto no rig", () => {
    const usadas = new Set(AVATARES.map((a) => a.pose));
    for (const p of POSES) expect(usadas.has(p), `pose "${p}" não é usada`).toBe(true);
  });
});
