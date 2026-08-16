import { describe, expect, it } from "vitest";

import { ITENS, ITENS_INICIAIS } from "../catalogo";
import { CABELOS, PELES } from "../paletas";
import { FIGURA_PADRAO, sanearFigura } from "../validar";

const TUDO = new Set(ITENS.map((i) => i.id));
const NADA = new Set<string>();

describe("sanearFigura — corpo", () => {
  it("lixo total vira o corpo padrão, sem roupa", () => {
    // `equipado` fica VAZIO de propósito: o padrão de roupa é brinde do
    // desbloqueio, não algo que o saneamento distribui. Vestir aqui daria
    // camiseta a quem não tem no inventário.
    const corpoPadrao = { ...FIGURA_PADRAO, equipado: {} };
    expect(sanearFigura(null, NADA).figura).toEqual(corpoPadrao);
    expect(sanearFigura("bla", NADA).figura).toEqual(corpoPadrao);
    expect(sanearFigura(42, NADA).figura).toEqual(corpoPadrao);
  });

  it("índice fora da faixa cai no padrão em vez de rejeitar", () => {
    const fora = { pele: PELES.length, cabeloCor: -1, barbaCor: 999 };
    const { figura } = sanearFigura(fora, NADA);
    expect(figura.pele).toBe(FIGURA_PADRAO.pele);
    expect(figura.cabeloCor).toBe(FIGURA_PADRAO.cabeloCor);
    expect(figura.barbaCor).toBe(FIGURA_PADRAO.barbaCor);
  });

  it("índice fracionário ou string não passa", () => {
    const { figura } = sanearFigura({ pele: 1.5, corpo: "2" }, NADA);
    expect(figura.pele).toBe(FIGURA_PADRAO.pele);
    expect(figura.corpo).toBe(FIGURA_PADRAO.corpo);
  });

  it("aceita índice válido nas duas pontas da paleta", () => {
    expect(sanearFigura({ pele: 0 }, NADA).figura.pele).toBe(0);
    expect(sanearFigura({ pele: PELES.length - 1 }, NADA).figura.pele).toBe(PELES.length - 1);
    expect(sanearFigura({ cabeloCor: CABELOS.length - 1 }, NADA).figura.cabeloCor).toBe(
      CABELOS.length - 1,
    );
  });

  it("estilo fora da whitelist cai no padrão", () => {
    const { figura } = sanearFigura(
      { cabelo: "shortHairShaggyMullet", olhos: "<script>", boca: 7, barba: null },
      NADA,
    );
    expect(figura.cabelo).toBe(FIGURA_PADRAO.cabelo);
    expect(figura.olhos).toBe(FIGURA_PADRAO.olhos);
    expect(figura.boca).toBe(FIGURA_PADRAO.boca);
    expect(figura.barba).toBe(FIGURA_PADRAO.barba);
  });

  it("sempre carimba v: 2", () => {
    expect(sanearFigura({ v: 1 }, NADA).figura.v).toBe(2);
  });
});

describe("sanearFigura — equipado", () => {
  it("id que não existe no catálogo sai como desconhecido", () => {
    const { figura, descartados } = sanearFigura(
      { equipado: { chapeu: "chapeu-de-mago" } },
      TUDO,
    );
    expect(figura.equipado.chapeu).toBeUndefined();
    expect(descartados).toEqual([
      { slot: "chapeu", itemId: "chapeu-de-mago", motivo: "desconhecido" },
    ]);
  });

  it("id real fora do inventário sai como nao_possui", () => {
    // É a assinatura de tentativa de vestir sem pagar — precisa sair separada
    // do descarte de rotina para valer alguma coisa no log.
    const { figura, descartados } = sanearFigura({ equipado: { chapeu: "coroa" } }, NADA);
    expect(figura.equipado.chapeu).toBeUndefined();
    expect(descartados).toEqual([{ slot: "chapeu", itemId: "coroa", motivo: "nao_possui" }]);
  });

  it("item no slot errado é desconhecido, não aceito", () => {
    const { figura, descartados } = sanearFigura({ equipado: { chapeu: "espada" } }, TUDO);
    expect(figura.equipado.chapeu).toBeUndefined();
    expect(descartados[0].motivo).toBe("desconhecido");
  });

  it("um item ruim não derruba os bons", () => {
    // A regra central: save nunca falha inteiro. Aba velha com um id morto não
    // pode custar ao usuário todas as outras escolhas.
    const { figura, descartados } = sanearFigura(
      { equipado: { torso: "camiseta-lisa", chapeu: "id-morto", pes: "tenis-branco" } },
      new Set(ITENS_INICIAIS),
    );
    expect(figura.equipado).toEqual({ torso: "camiseta-lisa", pes: "tenis-branco" });
    expect(descartados).toHaveLength(1);
  });

  it("id gigante é truncado antes de virar log", () => {
    const enorme = "x".repeat(5000);
    const { descartados } = sanearFigura({ equipado: { chapeu: enorme } }, TUDO);
    expect(descartados[0].itemId).toHaveLength(64);
  });

  it("ignora slot inventado e valor não-string", () => {
    const { figura, descartados } = sanearFigura(
      { equipado: { asa_secreta: "coroa", chapeu: 12, rosto: "" } },
      TUDO,
    );
    expect(figura.equipado).toEqual({});
    expect(descartados).toEqual([]);
  });

  it("equipado ausente ou de tipo errado não explode", () => {
    expect(sanearFigura({}, TUDO).figura.equipado).toEqual({});
    expect(sanearFigura({ equipado: "x" }, TUDO).figura.equipado).toEqual({});
  });
});

describe("sanearFigura — item de duas mãos", () => {
  it("espada na direita limpa a esquerda", () => {
    const { figura } = sanearFigura(
      { equipado: { maoDir: "espada", maoEsq: "escudo" } },
      TUDO,
    );
    expect(figura.equipado.maoDir).toBe("espada");
    expect(figura.equipado.maoEsq).toBeUndefined();
  });

  it("a limpeza não depende da ordem das chaves do JSON", () => {
    const a = sanearFigura({ equipado: { maoDir: "espada", maoEsq: "escudo" } }, TUDO);
    const b = sanearFigura({ equipado: { maoEsq: "escudo", maoDir: "espada" } }, TUDO);
    expect(a.figura.equipado).toEqual(b.figura.equipado);
  });

  it("item de uma mão convive com a esquerda", () => {
    const { figura } = sanearFigura(
      { equipado: { maoDir: "blaster", maoEsq: "escudo" } },
      TUDO,
    );
    expect(figura.equipado).toEqual({ maoDir: "blaster", maoEsq: "escudo" });
  });

  it("espada descartada não limpa a esquerda", () => {
    // Quem não tem a espada continua com o escudo na mão.
    const { figura, descartados } = sanearFigura(
      { equipado: { maoDir: "espada", maoEsq: "escudo" } },
      new Set(["escudo"]),
    );
    expect(figura.equipado).toEqual({ maoEsq: "escudo" });
    expect(descartados).toEqual([{ slot: "maoDir", itemId: "espada", motivo: "nao_possui" }]);
  });
});

describe("sanearFigura — idempotência", () => {
  it("sanear duas vezes dá o mesmo resultado", () => {
    const bruto = {
      pele: 3,
      corpo: 2,
      cabelo: "afro",
      cabeloCor: 4,
      olhos: "estrela",
      boca: "torto",
      sobrancelha: "grossa",
      barba: "cheia",
      barbaCor: 1,
      equipado: { chapeu: "coroa", maoDir: "espada", maoEsq: "escudo", aura: "aura-fogo" },
    };
    const uma = sanearFigura(bruto, TUDO).figura;
    const duas = sanearFigura(uma, TUDO).figura;
    expect(duas).toEqual(uma);
    expect(sanearFigura(uma, TUDO).descartados).toEqual([]);
  });

  it("a figura padrão sobrevive a ela mesma", () => {
    const { figura, descartados } = sanearFigura(FIGURA_PADRAO, new Set(ITENS_INICIAIS));
    expect(figura).toEqual(FIGURA_PADRAO);
    expect(descartados).toEqual([]);
  });
});
