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
/**
 * O atlas `/avatares/folha.png` foi cozido no Blender com os 30 avatares
 * originais numa grade 5×6. Em 22/08/26 removemos 11 comuns procedurais em
 * favor do kit Hyper3D — mas re-cozer o atlas exige rodar o pipeline Blender,
 * o que não vale a pena pra 19 células. Solução: mantemos as dimensões e a
 * ordem originais, e cada id do que sobrou aponta pra sua célula ANTIGA.
 * Células vazias (dos 11 removidos) continuam na imagem mas ninguém as
 * referencia.
 */
export const LINHAS_AVATAR = 6;

/**
 * Índice original de cada avatar na folha 5×6 baked no Blender.
 * NÃO usar `AVATARES.indexOf` — após a poda de 22/08/26, essa contagem
 * desalinharia com o pixel dentro da PNG.
 */
export const INDICE_AVATAR: ReadonlyMap<string, number> = new Map([
  // linha 0 (comuns 0-4) — só o Entregador (idx 9) sobrou nas comuns
  ["av-ciclista-urbano", 9],
  // linha 2 (incomuns 12-19) começam no idx 12
  ["av-tenista-clube", 12],
  ["av-surfista-fim-tarde", 13],
  ["av-nadadora-olimpica", 14],
  ["av-boxeador-aposentado", 15],
  ["av-jogador-sinuca", 16],
  ["av-halterofilista", 17],
  ["av-dj-torcida", 18],
  ["av-reporter-campo", 19],
  // linha 4 (raros 20-25)
  ["av-arbitro-vilao", 20],
  ["av-mascote-tigre", 21],
  ["av-piloto-kart", 22],
  ["av-xadrezista-sombrio", 23],
  ["av-capita-nautica", 24],
  ["av-ginasta-fita", 25],
  // linha 5 (épicos 26-28 + lendário 29)
  ["av-ninja-dojo", 26],
  ["av-bruxa-sorte", 27],
  ["av-astronauta-perdido", 28],
  ["av-rei-bolao", 29],
]);

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
