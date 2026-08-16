// Geometria da FOLHA de miniaturas — em pixels, não em 3D.
//
// Mora aqui, longe do three, porque quem consome o recorte é o card da loja: se
// isto vivesse ao lado do canvas que desenha a folha, importar `recorte` no
// card arrastaria o three para o bundle de render do servidor. O desenho está
// em `components/figura3d/Miniaturas.tsx`; o que ele produz é descrito aqui.

import { ITENS } from "./catalogo";

export const COLUNAS = 8;
export const LINHAS = Math.ceil(ITENS.length / COLUNAS);

/** Posição de cada item na folha. A ordem do catálogo É a ordem da grade. */
export const INDICE: ReadonlyMap<string, number> = new Map(ITENS.map((it, i) => [it.id, i]));

/**
 * O recorte de um item, em CSS.
 *
 * Porcentagem e não pixel: `background-position` em % é relativo ao tamanho do
 * elemento, então o mesmo estilo serve um card de 56px e um de 96px sem
 * recalcular nada. Com `background-size: N*100%`, a célula `i` cai em
 * `i/(N-1) * 100%` — a divisão por `N-1`, e não por `N`, é o que alinha a
 * última coluna na borda em vez de estourar para fora.
 */
export function recorte(id: string, folha: string): React.CSSProperties | undefined {
  const i = INDICE.get(id);
  if (i === undefined) return undefined;
  return {
    backgroundImage: `url(${folha})`,
    backgroundSize: `${COLUNAS * 100}% ${LINHAS * 100}%`,
    backgroundPosition: `${((i % COLUNAS) / (COLUNAS - 1)) * 100}% ${
      (Math.floor(i / COLUNAS) / (LINHAS - 1)) * 100
    }%`,
    backgroundRepeat: "no-repeat",
  };
}
