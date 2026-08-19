// Geometria da FOLHA de miniaturas — em pixels, não em 3D.
//
// Mora aqui, longe do three, porque quem consome o recorte é o card da loja: se
// isto vivesse ao lado do canvas que desenha a folha, importar `recorte` no
// card arrastaria o three para o bundle de render do servidor. O desenho está
// em `components/figura3d/Miniaturas.tsx`; o que ele produz é descrito aqui.

import { AVATARES } from "./avatares";
import { ITENS } from "./catalogo";

export const COLUNAS = 8;
export const LINHAS = Math.ceil(ITENS.length / COLUNAS);

/** Posição de cada item na folha. A ordem do catálogo É a ordem da grade. */
export const INDICE: ReadonlyMap<string, number> = new Map(ITENS.map((it, i) => [it.id, i]));

/**
 * São DUAS folhas, e não uma: o acessório cabe num quadrado e o personagem
 * pronto não — ele é de corpo inteiro, e espremer 2,86 unidades de altura numa
 * célula quadrada deixaria metade da célula vazia dos dois lados. Célula
 * retrato, portanto, e uma grade mais estreita.
 *
 * Separadas também porque a folha do cast só é desenhada quando alguém abre a
 * aba Avatares — trinta bonecos completos são caros demais para pagar na
 * montagem de quem só veio trocar de boné.
 */
export const COLUNAS_AVATAR = 5;
export const LINHAS_AVATAR = Math.ceil(AVATARES.length / COLUNAS_AVATAR);

export const INDICE_AVATAR: ReadonlyMap<string, number> = new Map(
  AVATARES.map((a, i) => [a.id, i]),
);

/**
 * O recorte de uma célula, em CSS.
 *
 * Porcentagem e não pixel: `background-position` em % é relativo ao tamanho do
 * elemento, então o mesmo estilo serve um card de 56px e um de 96px sem
 * recalcular nada. Com `background-size: N*100%`, a célula `i` cai em
 * `i/(N-1) * 100%` — a divisão por `N-1`, e não por `N`, é o que alinha a
 * última coluna na borda em vez de estourar para fora.
 */
function celula(
  i: number | undefined,
  folha: string,
  colunas: number,
  linhas: number,
): React.CSSProperties | undefined {
  if (i === undefined) return undefined;
  return {
    backgroundImage: `url(${folha})`,
    backgroundSize: `${colunas * 100}% ${linhas * 100}%`,
    backgroundPosition: `${((i % colunas) / (colunas - 1)) * 100}% ${
      (Math.floor(i / colunas) / (linhas - 1)) * 100
    }%`,
    backgroundRepeat: "no-repeat",
  };
}

export function recorte(id: string, folha: string): React.CSSProperties | undefined {
  return celula(INDICE.get(id), folha, COLUNAS, LINHAS);
}

export function recorteAvatar(id: string, folha: string): React.CSSProperties | undefined {
  return celula(INDICE_AVATAR.get(id), folha, COLUNAS_AVATAR, LINHAS_AVATAR);
}
