// Tipos do personagem 3D. TypeScript puro — nada de React, nada de three.
// Este módulo é importado pelo servidor (validação, preço) e pelo cliente
// (editor, render). Se algo aqui precisar de `window`, está no arquivo errado.

/** Os dez encaixes de acessório. Um item equipado por encaixe, no máximo. */
export const SLOTS = [
  "chapeu",
  "rosto",
  "torso",
  "pernas",
  "pes",
  "maoDir",
  "maoEsq",
  "costas",
  "aura",
  "veiculo",
] as const;

export type Slot = (typeof SLOTS)[number];

export const RARIDADES = ["comum", "incomum", "raro", "epico", "lendario"] as const;
export type Raridade = (typeof RARIDADES)[number];

/**
 * Tabela de preço. É a ÚNICA fonte de preço do app, e mora no servidor: a rota
 * de compra lê daqui, e o corpo do request não tem campo de preço para o
 * cliente adulterar.
 */
export const PRECO: Record<Raridade, number> = {
  comum: 50,
  incomum: 150,
  raro: 350,
  epico: 800,
  lendario: 2000,
};

/** Custo único para liberar o editor de personagem. Cobrado uma vez na vida. */
export const PRECO_DESBLOQUEIO = 100;

export type ItemCatalogo = {
  id: string;
  nome: string;
  slot: Slot;
  raridade: Raridade;
  /**
   * Qual geometria desenhar. O componente 3D (`components/figura3d/itens`)
   * mapeia `forma` → função de malha. Fica aqui, e não lá, para que o catálogo
   * continue importável pelo servidor sem arrastar o three junto.
   */
  forma: string;
  /** Parâmetros de cor da geometria. Cor aqui é DADO, não tema — ver nota abaixo. */
  cores: string[];
  /** Ícone lucide — só o que aparece enquanto a miniatura 3D do item não fica pronta. */
  icone: string;
  /** Ocupa as duas mãos: equipar limpa o outro lado. */
  duasMaos?: boolean;
  /** Some com o cabelo (capacete, cabeça de tubarão). */
  escondeCabelo?: boolean;
  /**
   * Some com olhos e sobrancelha. Sem isso o olho continua desenhado atrás da
   * lente e aparece como duas manchas dentro do óculos escuro.
   */
  escondeOlhos?: boolean;
  /** Some com boca e barba — máscara e focinho de tubarão cobrem os dois. */
  escondeBoca?: boolean;
  /** Preço 0 e já vem no inventário de todo mundo — ninguém fica pelado. */
  inicial?: boolean;
};

/**
 * O que fica salvo em `profiles.figura`.
 *
 * Os campos de corpo são ÍNDICE de paleta ou id de estilo, nunca hex solto: o
 * servidor valida por faixa/whitelist, e o cliente não consegue injetar uma cor
 * arbitrária no personagem de ninguém.
 */
export type FiguraV2 = {
  v: 2;
  pele: number;
  corpo: number;
  cabelo: string;
  cabeloCor: number;
  olhos: string;
  boca: string;
  sobrancelha: string;
  barba: string;
  barbaCor: number;
  equipado: Partial<Record<Slot, string>>;
  /**
   * Id de um personagem pronto (`av-*`, ver `lib/figura/avatares.ts`).
   *
   * QUANDO ISTO ESTÁ PREENCHIDO, TODO O RESTO DO OBJETO É IGNORADO NO RENDER.
   * O avatar do cast é uma unidade fechada — pele, roupa, pose e prop vêm do
   * catálogo, não do que o usuário montou. Os campos do boneco montável
   * continuam salvos de propósito: tirar o avatar tem que devolver exatamente o
   * personagem que estava lá antes, e não um boneco padrão.
   */
  avatar?: string;
};

/** Aceita tanto a v2 quanto a figura DiceBear antiga (que não tem `v`). */
export function ehFiguraV2(f: unknown): f is FiguraV2 {
  return !!f && typeof f === "object" && (f as { v?: unknown }).v === 2;
}
