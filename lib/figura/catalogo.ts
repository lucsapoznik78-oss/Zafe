// Catálogo da loja de personagem.
//
// POR QUE EM CÓDIGO E NÃO EM TABELA
// Um item aqui não é só "nome + preço": é `forma`, que aponta para uma função
// que constrói geometria 3D. Preço e malha precisam versionar juntos — item
// vendido cuja geometria sumiu num deploy é um buraco na tela de quem pagou.
// Em código, `npm test` cobre o catálogo inteiro e o servidor continua sendo a
// autoridade do preço (a rota lê daqui; o request não manda preço).
// O banco guarda só QUEM TEM O QUÊ (`figura_inventario`).
//
// As cores abaixo são parâmetro de material 3D — dado, não cromo de interface.
// Exceção declarada, mesma família de `lib/escalacao/cores.ts`.

import { PRECO, type ItemCatalogo, type Raridade, type Slot } from "./tipos";

export const ITENS: ItemCatalogo[] = [
  // ------------------------------------------------------------- CHAPÉUS
  { id: "bone-preto",      nome: "Boné",            slot: "chapeu", raridade: "comum",    forma: "bone",     cores: ["#17181B", "#2A2C31"], icone: "GraduationCap" },
  { id: "gorro-bege",      nome: "Gorro",           slot: "chapeu", raridade: "comum",    forma: "gorro",    cores: ["#C4A882"],            icone: "Snowflake" },
  { id: "bucket-camo",     nome: "Bucket camuflado", slot: "chapeu", raridade: "incomum", forma: "bucket",   cores: ["#4A5C3A", "#6B7F55"], icone: "GraduationCap" },
  { id: "capacete",        nome: "Capacete",        slot: "chapeu", raridade: "incomum",  forma: "capacete", cores: ["#C9CDD4", "#E5484D"], icone: "HardHat",   escondeCabelo: true },
  { id: "cabeca-tubarao",  nome: "Cabeça de tubarão", slot: "chapeu", raridade: "raro",   forma: "tubarao",  cores: ["#4A6E8F", "#F0F1F3"], icone: "Fish",      escondeCabelo: true, escondeOlhos: true, escondeBoca: true },
  { id: "rolo-papel",      nome: "Rolo de papel",   slot: "chapeu", raridade: "raro",     forma: "rolo",     cores: ["#F5F2EA", "#8A6A4A"], icone: "Cylinder",  escondeCabelo: true },
  { id: "coroa",           nome: "Coroa",           slot: "chapeu", raridade: "epico",    forma: "coroa",    cores: ["#F0B429", "#E5484D"], icone: "Crown" },

  // --------------------------------------------------------------- ROSTO
  { id: "oculos-escuros",  nome: "Óculos escuros",  slot: "rosto", raridade: "comum",   forma: "oculos",         cores: ["#0F1012", "#2A2C31"], icone: "Glasses",      escondeOlhos: true },
  { id: "oculos-redondos", nome: "Óculos redondos", slot: "rosto", raridade: "comum",   forma: "oculosRedondos", cores: ["#C9A227", "#9EA2AA"], icone: "Glasses" },
  { id: "mascara",         nome: "Máscara",         slot: "rosto", raridade: "incomum", forma: "mascara",        cores: ["#17181B"],            icone: "VenetianMask", escondeBoca: true },
  { id: "tapa-olho",       nome: "Tapa-olho",       slot: "rosto", raridade: "incomum", forma: "tapaOlho",       cores: ["#0F1012"],            icone: "EyeOff" },
  { id: "viseira-neon",    nome: "Viseira neon",    slot: "rosto", raridade: "epico",   forma: "viseira",        cores: ["#00E5FF", "#0F1012"], icone: "ScanLine",     escondeOlhos: true },

  // --------------------------------------------------------------- TORSO
  { id: "camiseta-lisa",     nome: "Camiseta lisa",     slot: "torso", raridade: "comum",   forma: "camiseta", cores: ["#F0F1F3"],            icone: "Shirt", inicial: true },
  { id: "camiseta-listrada", nome: "Camiseta listrada", slot: "torso", raridade: "comum",   forma: "camiseta", cores: ["#E5484D", "#F0F1F3"], icone: "Shirt" },
  { id: "moletom",           nome: "Moletom",           slot: "torso", raridade: "incomum", forma: "moletom",  cores: ["#17181B", "#F0F1F3"], icone: "Shirt" },
  { id: "jaqueta-jeans",     nome: "Jaqueta jeans",     slot: "torso", raridade: "incomum", forma: "jaqueta",  cores: ["#3D5A80", "#F5F2EA"], icone: "Shirt" },
  { id: "jaqueta-couro",     nome: "Jaqueta de couro",  slot: "torso", raridade: "raro",    forma: "jaqueta",  cores: ["#14151A", "#3A3D45"], icone: "Shirt" },
  { id: "terno",             nome: "Terno",             slot: "torso", raridade: "raro",    forma: "terno",    cores: ["#1B1D24", "#F0F1F3"], icone: "Shirt" },
  { id: "uniforme-verde",    nome: "Uniforme verde",    slot: "torso", raridade: "incomum", forma: "uniforme", cores: ["#2E9E63", "#F0F1F3"], icone: "Shirt" },
  { id: "uniforme-vermelho", nome: "Uniforme vermelho", slot: "torso", raridade: "incomum", forma: "uniforme", cores: ["#C0392B", "#F0F1F3"], icone: "Shirt" },
  { id: "uniforme-azul",     nome: "Uniforme azul",     slot: "torso", raridade: "incomum", forma: "uniforme", cores: ["#2B5CA8", "#F0F1F3"], icone: "Shirt" },
  { id: "uniforme-listrado", nome: "Uniforme listrado", slot: "torso", raridade: "incomum", forma: "uniforme", cores: ["#17181B", "#F0F1F3"], icone: "Shirt" },

  // -------------------------------------------------------------- PERNAS
  { id: "jeans-claro",   nome: "Jeans claro",   slot: "pernas", raridade: "comum",   forma: "jeans",  cores: ["#6E8CB5"], icone: "Footprints", inicial: true },
  { id: "jeans-preto",   nome: "Jeans preto",   slot: "pernas", raridade: "comum",   forma: "jeans",  cores: ["#1B1D22"], icone: "Footprints" },
  { id: "baggy-azul",    nome: "Baggy azul",    slot: "pernas", raridade: "comum",   forma: "baggy",  cores: ["#3D5A80"], icone: "Footprints" },
  { id: "jeans-rasgado", nome: "Jeans rasgado", slot: "pernas", raridade: "incomum", forma: "jeans",  cores: ["#4A4E57"], icone: "Footprints" },
  { id: "shorts",        nome: "Shorts",        slot: "pernas", raridade: "comum",   forma: "shorts", cores: ["#8A8F98"], icone: "Footprints" },
  { id: "calcao-time",   nome: "Calção de time", slot: "pernas", raridade: "incomum", forma: "shorts", cores: ["#F0F1F3", "#2E9E63"], icone: "Footprints" },

  // ------------------------------------------------------------------ PÉS
  { id: "tenis-branco", nome: "Tênis branco", slot: "pes", raridade: "comum",   forma: "tenis",    cores: ["#F0F1F3", "#C9CDD4"], icone: "Footprints", inicial: true },
  { id: "tenis-preto",  nome: "Tênis preto",  slot: "pes", raridade: "comum",   forma: "tenis",    cores: ["#17181B", "#3A3D45"], icone: "Footprints" },
  { id: "chinelo",      nome: "Chinelo",      slot: "pes", raridade: "comum",   forma: "chinelo",  cores: ["#2B5CA8", "#F0F1F3"], icone: "Footprints" },
  { id: "chuteira",     nome: "Chuteira",     slot: "pes", raridade: "incomum", forma: "chuteira", cores: ["#2E9E63", "#F0F1F3"], icone: "Footprints" },
  { id: "bota",         nome: "Bota",         slot: "pes", raridade: "incomum", forma: "bota",     cores: ["#6B4423"],            icone: "Footprints" },
  { id: "tenis-neon",   nome: "Tênis neon",   slot: "pes", raridade: "raro",    forma: "tenis",    cores: ["#00E5FF", "#0F1012"], icone: "Footprints" },

  // ------------------------------------------------------------ MÃO DIREITA
  { id: "bola-futebol", nome: "Bola de futebol", slot: "maoDir", raridade: "comum",   forma: "bola",      cores: ["#F0F1F3", "#17181B"], icone: "Volleyball" },
  { id: "microfone",    nome: "Microfone",       slot: "maoDir", raridade: "comum",   forma: "microfone", cores: ["#2A2C31", "#9EA2AA"], icone: "Mic" },
  { id: "taco",         nome: "Taco de beisebol", slot: "maoDir", raridade: "incomum", forma: "taco",     cores: ["#A9793F"],            icone: "Gavel" },
  { id: "skate",        nome: "Skate",           slot: "maoDir", raridade: "incomum", forma: "skate",     cores: ["#7C5CFC", "#C9CDD4"], icone: "Skull" },
  { id: "espada",       nome: "Espada",          slot: "maoDir", raridade: "raro",    forma: "espada",    cores: ["#DDE3EA", "#8A6A4A"], icone: "Swords",   duasMaos: true },
  { id: "blaster",      nome: "Blaster",         slot: "maoDir", raridade: "raro",    forma: "blaster",   cores: ["#2A2C31", "#00E5FF"], icone: "Zap" },
  { id: "trofeu",       nome: "Troféu",          slot: "maoDir", raridade: "epico",   forma: "trofeu",    cores: ["#F0B429", "#8A6A4A"], icone: "Trophy" },

  // ------------------------------------------------------------ MÃO ESQUERDA
  { id: "celular",  nome: "Celular",  slot: "maoEsq", raridade: "comum", forma: "celular",  cores: ["#17181B", "#4C8DFF"], icone: "Smartphone" },
  { id: "buque",    nome: "Buquê",    slot: "maoEsq", raridade: "comum", forma: "buque",    cores: ["#E5484D", "#2E9E63"], icone: "Flower" },
  { id: "lanterna", nome: "Lanterna", slot: "maoEsq", raridade: "comum", forma: "lanterna", cores: ["#C9CDD4", "#F0B429"], icone: "Flashlight" },
  { id: "escudo",   nome: "Escudo",   slot: "maoEsq", raridade: "raro",  forma: "escudo",   cores: ["#4C8DFF", "#DDE3EA"], icone: "Shield" },

  // -------------------------------------------------------------- COSTAS
  { id: "mochila", nome: "Mochila",       slot: "costas", raridade: "comum",     forma: "mochila", cores: ["#2A2C31", "#E5484D"], icone: "Backpack" },
  { id: "capa",    nome: "Capa",          slot: "costas", raridade: "incomum",   forma: "capa",    cores: ["#C0392B"],            icone: "Wind" },
  { id: "prancha", nome: "Prancha",       slot: "costas", raridade: "raro",      forma: "prancha", cores: ["#F0F1F3", "#00E5FF"], icone: "Waves" },
  { id: "asas",    nome: "Asas",          slot: "costas", raridade: "lendario",  forma: "asas",    cores: ["#F5F2EA"],            icone: "Feather" },

  // ---------------------------------------------------------------- AURA
  { id: "aura-roxa",    nome: "Vibe roxa",     slot: "aura", raridade: "epico",    forma: "aura", cores: ["#A855F7"], icone: "Sparkles" },
  { id: "aura-azul",    nome: "Azul elétrico", slot: "aura", raridade: "epico",    forma: "aura", cores: ["#4C8DFF"], icone: "Sparkles" },
  { id: "aura-verde",   nome: "Verde tóxico",  slot: "aura", raridade: "epico",    forma: "aura", cores: ["#3FBE7B"], icone: "Sparkles" },
  { id: "aura-dourada", nome: "Brilho dourado", slot: "aura", raridade: "lendario", forma: "aura", cores: ["#F0B429"], icone: "Sparkles" },
  { id: "aura-fogo",    nome: "Em chamas",     slot: "aura", raridade: "lendario", forma: "aura", cores: ["#FF6B35"], icone: "Flame" },

  // ------------------------------------------------------------- VEÍCULO
  { id: "bicicleta",   nome: "Bicicleta",         slot: "veiculo", raridade: "incomum",  forma: "bicicleta", cores: ["#2E9E63", "#17181B"], icone: "Bike" },
  { id: "moto",        nome: "Moto",              slot: "veiculo", raridade: "raro",     forma: "moto",      cores: ["#17181B", "#E5484D"], icone: "Bike" },
  { id: "conversivel", nome: "Conversível retrô", slot: "veiculo", raridade: "raro",     forma: "carro",     cores: ["#7FD1C1", "#F5F2EA"], icone: "Car" },
  { id: "suv",         nome: "SUV",               slot: "veiculo", raridade: "epico",    forma: "suv",       cores: ["#17181B", "#3A3D45"], icone: "Truck" },
  { id: "esportivo",   nome: "Esportivo",         slot: "veiculo", raridade: "epico",    forma: "carro",     cores: ["#F0B429", "#17181B"], icone: "Car" },
  { id: "neon-racer",  nome: "Neon racer",        slot: "veiculo", raridade: "lendario", forma: "carro",     cores: ["#7C5CFC", "#00E5FF"], icone: "Car" },
];

/** Índice por id. O `!` da busca é a única coisa que separa "existe" de "não existe". */
export const POR_ID: ReadonlyMap<string, ItemCatalogo> = new Map(ITENS.map((i) => [i.id, i]));

export function item(id: string): ItemCatalogo | undefined {
  return POR_ID.get(id);
}

/**
 * O preço que o servidor cobra. Item inicial custa 0 — é brinde de boas-vindas,
 * não item de graça por bug.
 */
export function precoDe(it: ItemCatalogo): number {
  return it.inicial ? 0 : PRECO[it.raridade];
}

export function precoPorId(id: string): number | null {
  const it = POR_ID.get(id);
  return it ? precoDe(it) : null;
}

/** Itens que todo usuário recebe de graça ao desbloquear o personagem. */
export const ITENS_INICIAIS: string[] = ITENS.filter((i) => i.inicial).map((i) => i.id);

export const ITENS_POR_SLOT: Record<Slot, ItemCatalogo[]> = ITENS.reduce(
  (acc, it) => {
    (acc[it.slot] ??= []).push(it);
    return acc;
  },
  {} as Record<Slot, ItemCatalogo[]>,
);

export const ROTULO_SLOT: Record<Slot, string> = {
  chapeu: "Cabeça",
  rosto: "Rosto",
  torso: "Parte de cima",
  pernas: "Parte de baixo",
  pes: "Calçado",
  maoDir: "Mão direita",
  maoEsq: "Mão esquerda",
  costas: "Costas",
  aura: "Aura",
  veiculo: "Veículo",
};

export type { ItemCatalogo, Raridade, Slot };
