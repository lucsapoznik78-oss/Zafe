// Saneamento da figura no servidor.
//
// REGRA CENTRAL: item que não passa é DESCARTADO, não rejeitado. Um save nunca
// pode falhar inteiro por causa de um id velho numa aba que ficou aberta desde
// antes de um deploy — o usuário perderia todas as outras escolhas junto. O que
// não é reconhecido simplesmente não vai para o banco.
//
// Mas as duas causas de descarte são coisas MUITO diferentes e por isso saem
// separadas em `descartados`:
//   desconhecido → id que não existe mais no catálogo. Aba velha. Rotina.
//   nao_possui   → id real que o usuário não comprou. Isso é tentativa de vestir
//                  item sem pagar, e é o que vale a pena olhar no log.

import {
  BARBAS,
  BOCAS,
  CABELOS,
  CABELO_ESTILOS,
  CORPOS,
  OLHOS,
  PELES,
  SOBRANCELHAS,
} from "./paletas";
import { AVATAR_POR_ID } from "./avatares";
import { POR_ID } from "./catalogo";
import { SLOTS, type FiguraV2, type Slot } from "./tipos";

const IDS = <T extends { id: string }>(xs: readonly T[]) => new Set(xs.map((x) => x.id));

const SET_CABELO = IDS(CABELO_ESTILOS);
const SET_OLHOS = IDS(OLHOS);
const SET_BOCA = IDS(BOCAS);
const SET_SOBRANCELHA = IDS(SOBRANCELHAS);
const SET_BARBA = IDS(BARBAS);

export const FIGURA_PADRAO: FiguraV2 = {
  v: 2,
  pele: 1,
  corpo: 1,
  cabelo: "curto",
  cabeloCor: 0,
  olhos: "normal",
  boca: "sorriso",
  sobrancelha: "normal",
  barba: "nenhuma",
  barbaCor: 0,
  equipado: { torso: "camiseta-lisa", pernas: "jeans-claro", pes: "tenis-branco" },
};

function indice(v: unknown, tamanho: number, padrao: number): number {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) < tamanho ? (v as number) : padrao;
}

function escolha(v: unknown, permitidos: Set<string>, padrao: string): string {
  return typeof v === "string" && permitidos.has(v) ? v : padrao;
}

export type Descarte = {
  /** `"avatar"` não é um slot de acessório — é o cast, que substitui o boneco. */
  slot: Slot | "avatar";
  itemId: string;
  motivo: "desconhecido" | "nao_possui";
};

export type ResultadoSaneamento = {
  figura: FiguraV2;
  descartados: Descarte[];
};

/**
 * @param bruto     o que veio no request — pode ser qualquer coisa
 * @param inventario ids que o usuário realmente possui
 */
export function sanearFigura(bruto: unknown, inventario: Set<string>): ResultadoSaneamento {
  const f = (bruto ?? {}) as Record<string, unknown>;
  const descartados: Descarte[] = [];

  const figura: FiguraV2 = {
    v: 2,
    pele: indice(f.pele, PELES.length, FIGURA_PADRAO.pele),
    corpo: indice(f.corpo, CORPOS.length, FIGURA_PADRAO.corpo),
    cabelo: escolha(f.cabelo, SET_CABELO, FIGURA_PADRAO.cabelo),
    cabeloCor: indice(f.cabeloCor, CABELOS.length, FIGURA_PADRAO.cabeloCor),
    olhos: escolha(f.olhos, SET_OLHOS, FIGURA_PADRAO.olhos),
    boca: escolha(f.boca, SET_BOCA, FIGURA_PADRAO.boca),
    sobrancelha: escolha(f.sobrancelha, SET_SOBRANCELHA, FIGURA_PADRAO.sobrancelha),
    barba: escolha(f.barba, SET_BARBA, FIGURA_PADRAO.barba),
    barbaCor: indice(f.barbaCor, CABELOS.length, FIGURA_PADRAO.barbaCor),
    equipado: {},
  };

  const bruteEquip = (f.equipado ?? {}) as Record<string, unknown>;
  for (const slot of SLOTS) {
    const id = bruteEquip[slot];
    if (typeof id !== "string" || id.length === 0) continue;

    const cat = POR_ID.get(id);
    if (!cat || cat.slot !== slot) {
      descartados.push({ slot, itemId: id.slice(0, 64), motivo: "desconhecido" });
      continue;
    }
    if (!inventario.has(id)) {
      descartados.push({ slot, itemId: id, motivo: "nao_possui" });
      continue;
    }
    figura.equipado[slot] = id;
  }

  // Item de duas mãos ganha do que estiver na esquerda. Aplicado DEPOIS do laço
  // porque a ordem de chegada das chaves do JSON não é garantida — decidir isso
  // durante a varredura daria resultado diferente conforme o cliente serializou.
  const dir = figura.equipado.maoDir;
  if (dir && POR_ID.get(dir)?.duasMaos) delete figura.equipado.maoEsq;

  // O avatar pronto passa pelo MESMO crivo dos acessórios: existe no catálogo e
  // está no inventário. Ele não limpa `equipado` — o boneco montado continua
  // salvo debaixo dele, e é o que volta quando o usuário escolhe "sem avatar".
  const idAvatar = f.avatar;
  if (typeof idAvatar === "string" && idAvatar.length > 0) {
    if (!AVATAR_POR_ID.has(idAvatar)) {
      descartados.push({ slot: "avatar", itemId: idAvatar.slice(0, 64), motivo: "desconhecido" });
    } else if (!inventario.has(idAvatar)) {
      descartados.push({ slot: "avatar", itemId: idAvatar, motivo: "nao_possui" });
    } else {
      figura.avatar = idAvatar;
    }
  }

  return { figura, descartados };
}
