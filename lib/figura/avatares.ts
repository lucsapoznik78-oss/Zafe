// O cast: 30 personagens prontos, comprados inteiros.
//
// POR QUE ISTO NÃO É MAIS UM SLOT DA LOJA DE ACESSÓRIOS
//
// A loja de acessórios vende PEÇAS e o jogador monta. Aqui o modelo é o oposto,
// e é deliberado (doc "Zafe — Sistema de Avatares", §1): o personagem é uma
// unidade indivisível, com nome, pose e narrativa. Não se compra o chapéu da
// Bruxa da Sorte; compra-se a Bruxa da Sorte. É o modelo do GeoGuessr, e o que
// faz o Lendário significar alguma coisa — se desse para comprar a coroa
// separada, o Rei do Bolão viraria um chapéu de Z$ 800.
//
// Por isso não existe `slot` neste arquivo, e por isso o avatar escolhido
// SUBSTITUI o boneco montado em vez de se somar a ele.
//
// O QUE ESTE ARQUIVO É E O QUE NÃO É
//
// É dado puro: nada de React, nada de three. O servidor importa daqui para
// saber o preço (a rota de compra nunca lê preço do request) e para validar o
// que o cliente diz ter vestido. A geometria correspondente mora em
// `components/figura3d/avatar/` e lê estes mesmos campos.
//
// As cores são parâmetro de material 3D — dado, não cromo de interface. Mesma
// exceção declarada de `paletas.ts` e `lib/escalacao/cores.ts`.

import type { Raridade } from "./tipos";

/**
 * Preço do personagem inteiro.
 *
 * NÃO é o `PRECO` dos acessórios: o Lendário custa Z$ 2.500 (e não 2.000)
 * porque é um único item no cast inteiro, e o preço é parte do que faz dele um
 * símbolo. Os outros quatro degraus coincidem por enquanto — manter as duas
 * tabelas separadas é o que permite mexer numa sem mexer na outra.
 */
export const PRECO_AVATAR: Record<Raridade, number> = {
  comum: 50,
  incomum: 150,
  raro: 350,
  epico: 800,
  lendario: 2500,
};

/**
 * As dez poses do cast. Nenhuma é simétrica — a T-pose foi o erro mais visível
 * da v1 e está proibida por especificação (doc §2, linha "Pose").
 */
export const POSES = [
  "idle",
  "hipshot",
  "cheer",
  "point",
  "thumbsup",
  "peace",
  "flex",
  "card",
  "cast",
  "scepter",
] as const;
export type Pose = (typeof POSES)[number];

/** Raiz → meio → ponta. O gradiente de três paradas é obrigatório (doc §3). */
export type Cabelo = {
  estilo:
    | "careca"
    | "curto"
    | "espetado"
    | "afro"
    | "longo"
    | "rabo"
    | "coque"
    | "franja"
    | "chanel"
    | "salgado"
    | "grisalho";
  cores: [string, string, string];
};

export type Rosto = {
  olhos:
    | "normal"
    | "feliz"
    | "piscada"
    | "determinado"
    | "bravo"
    | "sereno"
    | "surpreso"
    | "sono"
    | "fechado";
  sobrancelha: "neutra" | "erguida" | "brava" | "torta";
  boca: "sorriso" | "sorrisoTorto" | "aberta" | "serio" | "dentes" | "bico";
  /**
   * De que lado cai a assimetria: qual olho pisca, qual sobrancelha sobe.
   * −1 é a direita do personagem (esquerda de quem olha).
   */
  lado: -1 | 1;
  blush: boolean;
  barba?: { tipo: "bigode" | "cavanhaque" | "cheia" | "costeleta"; cor: string };
};

export type Chapeu = {
  tipo:
    | "bone"
    | "boneTras"
    | "gorro"
    | "capaceteAero"
    | "capaceteIntegral"
    | "quepe"
    | "chapeuBruxa"
    | "coroa"
    | "capuzTigre"
    | "capaceteEspacial"
    | "toucaNatacao"
    | "bandana"
    | "capuz"
    | "headphone"
    | "faixaTesta";
  cores: string[];
  /** Capacete integral e capuz de bicho comem o cabelo inteiro. */
  escondeCabelo?: boolean;
  /** Visor e máscara cobrem os olhos — desenhá-los atrás vira mancha no vidro. */
  escondeOlhos?: boolean;
};

/** Acessório de rosto que convive com o chapéu (óculos sob capacete, etc.). */
export type Face = {
  tipo:
    | "oculosEscuros"
    | "oculosEspelhados"
    | "oculosNatacao"
    | "oculosRedondos"
    | "pinturaFacial"
    | "mascaraShinobi"
    | "visorDourado";
  cores: string[];
  escondeOlhos?: boolean;
};

/**
 * A roupa é montada em CAMADAS, não escolhida numa lista de peças prontas.
 *
 * `base` dá o volume, `manga` é geometria diferente (não a mesma com cor
 * trocada, doc §3), `gola` e `detalhe` são o que separa "retângulo colorido" de
 * "moletom". Toda peça sai com gola e bainha; a bainha é desenhada num tom mais
 * escuro para dar espessura ao tecido no lugar de oclusão ambiente de verdade.
 */
export type Roupa = {
  base:
    | "camisa"
    | "regata"
    | "jaqueta"
    | "terno"
    | "macacao"
    | "vestido"
    | "collant"
    | "pelucia"
    | "roupao"
    | "espacial"
    | "manto";
  manga: "sem" | "curta" | "longa";
  gola: "redonda" | "v" | "camisa" | "capuz" | "alta";
  /** [principal, secundária, detalhe]. */
  cores: string[];
  detalhe?:
    | "numero"
    | "listras"
    | "ziper"
    | "bolso"
    | "cordao"
    | "botoes"
    | "gravata"
    | "colete"
    | "cinturao"
    | "medalha"
    | "peitoral";
  /** Só faz sentido com `detalhe: "numero"`. */
  numero?: number;
};

export type Baixo = {
  tipo: "calca" | "shorts" | "calcao" | "saia" | "meiao" | "nenhum";
  cores: string[];
};

export type Calcado = {
  tipo: "tenis" | "chuteira" | "bota" | "sapato" | "sapatilha" | "patas" | "descalco";
  cores: string[];
};

export type Prop = {
  tipo:
    | "bola"
    | "cachecol"
    | "prancheta"
    | "radio"
    | "pipoca"
    | "skate"
    | "celular"
    | "raquete"
    | "prancha"
    | "luvaBoxe"
    | "tacoSinuca"
    | "halter"
    | "microfone"
    | "cartaoVermelho"
    | "luneta"
    | "fita"
    | "shuriken"
    | "pocao"
    | "cetro"
    | "luvaGoleiro"
    | "cronometro"
    | "garrafa";
  cores: string[];
  /** Ocupa as duas mãos — o outro lado não recebe prop. */
  duasMaos?: boolean;
};

export type Costas = {
  tipo: "cauda" | "mochilaEspacial" | "capa" | "prancha" | "mochila";
  cores: string[];
};

export type AvatarCatalogo = {
  /** Prefixo `av-` é o que separa o namespace do avatar do de acessório na mesma tabela de inventário. */
  id: string;
  nome: string;
  raridade: Raridade;
  /** A narrativa curta do doc. Aparece no card e é metade do que se está comprando. */
  descricao: string;
  pose: Pose;
  /** Índice em `PELES`. */
  pele: number;
  cabelo: Cabelo;
  rosto: Rosto;
  roupa: Roupa;
  baixo: Baixo;
  calcado: Calcado;
  chapeu?: Chapeu;
  face?: Face;
  /** Prop na mão da pose, nunca colado no peito (doc §3). */
  maoDir?: Prop;
  maoEsq?: Prop;
  costas?: Costas;
  /** Só Épico e Lendário. Partículas emissivas ao redor — é o que quebra a silhueta. */
  aura?: string;
};

// Tons recorrentes. Nomeados para o cast inteiro parecer do mesmo jogo — base
// neutra dominante mais UMA cor de destaque por personagem (doc §2, "Paleta").
const BRANCO = "#F2F4F7";
const OSSO = "#E3E1D8";
const GRAFITE = "#22242B";
const PRETO = "#15161A";
const JEANS_ESCURO = "#26364B";

export const AVATARES: AvatarCatalogo[] = [
  // ============================================================== COMUNS (12)
  {
    id: "av-boleiro-varzea",
    nome: "Boleiro de Várzea",
    raridade: "comum",
    descricao: "Camisa de time de bairro puída, meião subido, joelho ralado de domingo.",
    pose: "hipshot",
    pele: 3,
    cabelo: { estilo: "curto", cores: ["#1B1B1F", "#2C2A28", "#453B33"] },
    rosto: { olhos: "normal", sobrancelha: "torta", boca: "sorrisoTorto", lado: -1, blush: true },
    roupa: { base: "camisa", manga: "curta", gola: "v", cores: [BRANCO, "#2B5CA8", "#1B3C74"], detalhe: "numero", numero: 2 },
    baixo: { tipo: "calcao", cores: ["#2B5CA8", BRANCO] },
    calcado: { tipo: "chuteira", cores: [BRANCO, "#2B5CA8"] },
    maoDir: { tipo: "bola", cores: [BRANCO, PRETO] },
  },
  {
    id: "av-torcedor-arquibancada",
    nome: "Torcedor de Arquibancada",
    raridade: "comum",
    descricao: "Rosto pintado, cachecol erguido, garganta já rouca no primeiro tempo.",
    pose: "cheer",
    pele: 1,
    cabelo: { estilo: "espetado", cores: ["#4A2C17", "#6B4423", "#8C5E32"] },
    rosto: { olhos: "feliz", sobrancelha: "erguida", boca: "aberta", lado: 1, blush: true },
    face: { tipo: "pinturaFacial", cores: ["#C0392B", BRANCO] },
    roupa: { base: "camisa", manga: "curta", gola: "redonda", cores: ["#C0392B", "#8E2117", BRANCO], detalhe: "listras" },
    baixo: { tipo: "calca", cores: [GRAFITE] },
    calcado: { tipo: "tenis", cores: [BRANCO, "#C0392B"] },
    maoDir: { tipo: "cachecol", cores: ["#C0392B", BRANCO], duasMaos: true },
  },
  {
    id: "av-estagiario-bolao",
    nome: "Estagiário do Bolão",
    raridade: "comum",
    descricao: "Gravata torta, planilha do bolão do escritório debaixo do braço, confiança acima da média.",
    pose: "point",
    pele: 2,
    cabelo: { estilo: "curto", cores: ["#2A1E16", "#3A2A20", "#54402F"] },
    rosto: { olhos: "normal", sobrancelha: "erguida", boca: "sorriso", lado: 1, blush: false },
    roupa: { base: "camisa", manga: "longa", gola: "camisa", cores: [BRANCO, "#D9DCE2", "#2B4C8C"], detalhe: "gravata" },
    baixo: { tipo: "calca", cores: [JEANS_ESCURO] },
    calcado: { tipo: "sapato", cores: ["#2A2119"] },
    maoEsq: { tipo: "prancheta", cores: [BRANCO, "#8A6A4A"] },
  },
  {
    id: "av-vovo-radio",
    nome: "Vovô do Rádio",
    raridade: "comum",
    descricao: "Rádio de pilha colado no ouvido. Não confia em narração de TV desde 1994.",
    pose: "idle",
    pele: 0,
    cabelo: { estilo: "grisalho", cores: ["#9EA2AA", "#C9CDD4", "#E6E8EC"] },
    rosto: {
      olhos: "sereno",
      sobrancelha: "neutra",
      boca: "sorriso",
      lado: -1,
      blush: true,
      barba: { tipo: "bigode", cor: "#C9CDD4" },
    },
    face: { tipo: "oculosRedondos", cores: ["#8A6A4A", "#C9CDD4"] },
    roupa: { base: "jaqueta", manga: "longa", gola: "v", cores: ["#9C8B62", "#7B6C4A", "#5F5238"], detalhe: "botoes" },
    baixo: { tipo: "calca", cores: ["#4A4E57"] },
    calcado: { tipo: "sapato", cores: ["#4A3728"] },
    maoDir: { tipo: "radio", cores: [GRAFITE, "#8A8F98"] },
  },
  {
    id: "av-corredor-rua",
    nome: "Corredor de Rua",
    raridade: "comum",
    descricao: "Regata fluorescente, número de peito ainda colado da corrida de domingo.",
    pose: "thumbsup",
    pele: 5,
    cabelo: { estilo: "curto", cores: ["#101014", "#1B1B1F", "#2C2C33"] },
    rosto: { olhos: "feliz", sobrancelha: "erguida", boca: "dentes", lado: -1, blush: true },
    roupa: { base: "regata", manga: "sem", gola: "redonda", cores: ["#FF6B35", "#D8501F", BRANCO], detalhe: "numero", numero: 105 },
    baixo: { tipo: "shorts", cores: [PRETO, "#FF6B35"] },
    calcado: { tipo: "tenis", cores: [PRETO, "#FF6B35"] },
    maoEsq: { tipo: "garrafa", cores: ["#4C8DFF", BRANCO] },
  },
  {
    id: "av-goleiro-reserva",
    nome: "Goleiro Reserva",
    raridade: "comum",
    descricao: "Luvas grandes demais, banco aquecido há três temporadas.",
    pose: "idle",
    pele: 4,
    cabelo: { estilo: "curto", cores: ["#1B1B1F", "#2A2320", "#3A302A"] },
    rosto: { olhos: "sono", sobrancelha: "neutra", boca: "serio", lado: 1, blush: false },
    chapeu: { tipo: "bandana", cores: ["#17181B"] },
    roupa: { base: "camisa", manga: "longa", gola: "redonda", cores: ["#2E9E63", "#1E7A4A", BRANCO], detalhe: "numero", numero: 7 },
    baixo: { tipo: "calcao", cores: ["#1E7A4A"] },
    calcado: { tipo: "chuteira", cores: ["#2E9E63", BRANCO] },
    maoDir: { tipo: "luvaGoleiro", cores: [BRANCO, "#2E9E63"], duasMaos: true },
  },
  {
    id: "av-vendedor-pipoca",
    nome: "Vendedor de Pipoca",
    raridade: "comum",
    descricao: "Sobe e desce a arquibancada inteira no intervalo. Conhece o placar antes do telão.",
    pose: "point",
    pele: 3,
    cabelo: { estilo: "curto", cores: ["#241A12", "#3A2A20", "#4E3A2A"] },
    rosto: { olhos: "feliz", sobrancelha: "erguida", boca: "dentes", lado: -1, blush: true },
    chapeu: { tipo: "bone", cores: ["#17181B", "#2A2C31"] },
    roupa: { base: "camisa", manga: "curta", gola: "redonda", cores: ["#F0B429", "#C9931D", GRAFITE], detalhe: "bolso" },
    baixo: { tipo: "calca", cores: [GRAFITE] },
    calcado: { tipo: "tenis", cores: [BRANCO, "#C9CDD4"] },
    maoEsq: { tipo: "pipoca", cores: ["#C0392B", BRANCO] },
  },
  {
    id: "av-menina-volei",
    nome: "Menina do Vôlei",
    raridade: "comum",
    descricao: "Joelheira sempre colocada, rabo de cavalo apertado, saque que ninguém defende.",
    pose: "cheer",
    pele: 1,
    cabelo: { estilo: "rabo", cores: ["#4A2C17", "#6B4423", "#96683A"] },
    rosto: { olhos: "piscada", sobrancelha: "erguida", boca: "sorriso", lado: 1, blush: true },
    roupa: { base: "camisa", manga: "curta", gola: "redonda", cores: ["#2B5CA8", "#1B3C74", BRANCO], detalhe: "numero", numero: 9 },
    baixo: { tipo: "shorts", cores: ["#1B3C74"] },
    calcado: { tipo: "tenis", cores: [BRANCO, "#2B5CA8"] },
  },
  {
    id: "av-skatista-praca",
    nome: "Skatista de Praça",
    raridade: "comum",
    descricao: "Boné pra trás, camiseta larga, cicatriz no cotovelo de manobra que não deu.",
    pose: "hipshot",
    pele: 2,
    cabelo: { estilo: "curto", cores: ["#1B1B1F", "#2C2A28", "#3E3833"] },
    rosto: { olhos: "determinado", sobrancelha: "torta", boca: "sorrisoTorto", lado: 1, blush: false },
    chapeu: { tipo: "boneTras", cores: ["#3A2A20", "#54402F"] },
    roupa: { base: "camisa", manga: "curta", gola: "redonda", cores: ["#7C5CFC", "#5B3FD1", "#1B1B1F"], detalhe: "bolso" },
    baixo: { tipo: "calca", cores: ["#4A4E57"] },
    calcado: { tipo: "tenis", cores: [PRETO, BRANCO] },
    maoEsq: { tipo: "skate", cores: ["#7C5CFC", "#C9CDD4"] },
  },
  {
    id: "av-ciclista-urbano",
    nome: "Ciclista Urbano",
    raridade: "comum",
    descricao: "Capacete aero, óculos espelhados, 60 km antes do café da manhã.",
    pose: "thumbsup",
    pele: 2,
    cabelo: { estilo: "careca", cores: ["#2A1E16", "#3A2A20", "#54402F"] },
    rosto: { olhos: "normal", sobrancelha: "neutra", boca: "sorriso", lado: -1, blush: true },
    chapeu: { tipo: "capaceteAero", cores: ["#5A3E1F", "#8A6A4A"], escondeCabelo: true },
    face: { tipo: "oculosEspelhados", cores: ["#F0B429", GRAFITE], escondeOlhos: true },
    roupa: { base: "camisa", manga: "curta", gola: "alta", cores: ["#F0B429", "#C9931D", GRAFITE], detalhe: "numero", numero: 2 },
    baixo: { tipo: "shorts", cores: [PRETO] },
    calcado: { tipo: "tenis", cores: ["#F0B429", PRETO] },
  },
  {
    id: "av-zelador-estadio",
    nome: "Zelador do Estádio",
    raridade: "comum",
    descricao: "Conhece cada assoalho do estádio. Já viu mais jogo que qualquer sócio.",
    pose: "idle",
    pele: 5,
    cabelo: { estilo: "grisalho", cores: ["#8A8F98", "#C9CDD4", "#E6E8EC"] },
    rosto: {
      olhos: "sereno",
      sobrancelha: "neutra",
      boca: "serio",
      lado: 1,
      blush: false,
      barba: { tipo: "cheia", cor: "#C9CDD4" },
    },
    roupa: { base: "macacao", manga: "longa", gola: "camisa", cores: ["#2F6B44", "#225033", "#F0B429"], detalhe: "ziper" },
    baixo: { tipo: "calca", cores: ["#4A4E57"] },
    calcado: { tipo: "bota", cores: ["#4A3728"] },
  },
  {
    id: "av-tiete-fantasy",
    nome: "Tiete do Fantasy",
    raridade: "comum",
    descricao: "Escalação montada às 3h da manhã. Sabe o preço de cada jogador de cor.",
    pose: "peace",
    pele: 1,
    cabelo: { estilo: "franja", cores: ["#8E2117", "#C0392B", "#E5484D"] },
    rosto: { olhos: "piscada", sobrancelha: "erguida", boca: "sorrisoTorto", lado: -1, blush: true },
    chapeu: { tipo: "capuz", cores: ["#17181B", "#2A2C31"] },
    roupa: { base: "jaqueta", manga: "longa", gola: "capuz", cores: ["#17181B", "#2A2C31", "#00E5FF"], detalhe: "cordao" },
    baixo: { tipo: "calca", cores: [GRAFITE] },
    calcado: { tipo: "tenis", cores: [BRANCO, "#00E5FF"] },
    maoEsq: { tipo: "celular", cores: [PRETO, "#00E5FF"] },
  },

  // ============================================================ INCOMUNS (8)
  {
    id: "av-tenista-clube",
    nome: "Tenista de Clube",
    raridade: "incomum",
    descricao: "Tudo branco impecável, faixa na testa, raquete que custa mais que a mensalidade.",
    pose: "point",
    pele: 0,
    cabelo: { estilo: "rabo", cores: ["#B99048", "#D8B26A", "#EBD49A"] },
    rosto: { olhos: "determinado", sobrancelha: "erguida", boca: "sorriso", lado: 1, blush: true },
    chapeu: { tipo: "faixaTesta", cores: [BRANCO, "#2E9E63"] },
    roupa: { base: "vestido", manga: "sem", gola: "redonda", cores: [BRANCO, "#DDE3EA", "#2E9E63"], detalhe: "medalha" },
    baixo: { tipo: "saia", cores: [BRANCO, "#DDE3EA"] },
    calcado: { tipo: "tenis", cores: [BRANCO, "#2E9E63"] },
    maoDir: { tipo: "raquete", cores: ["#DDE3EA", "#2E9E63"] },
  },
  {
    id: "av-surfista-fim-tarde",
    nome: "Surfista de Fim de Tarde",
    raridade: "incomum",
    descricao: "Cabelo salgado, bermuda desbotada, prancha sempre a tiracolo. Bronzeado o ano inteiro.",
    pose: "thumbsup",
    pele: 2,
    cabelo: { estilo: "salgado", cores: ["#A9793F", "#D8B26A", "#F2DFA8"] },
    rosto: { olhos: "sereno", sobrancelha: "torta", boca: "sorrisoTorto", lado: -1, blush: true },
    roupa: { base: "regata", manga: "sem", gola: "v", cores: ["#2AA9C4", "#1B7A90", BRANCO], detalhe: "listras" },
    baixo: { tipo: "shorts", cores: ["#F0B429", "#C9931D"] },
    calcado: { tipo: "descalco", cores: [] },
    maoEsq: { tipo: "prancha", cores: [BRANCO, "#00E5FF"] },
  },
  {
    id: "av-nadadora-olimpica",
    nome: "Nadadora Olímpica",
    raridade: "incomum",
    descricao: "Touca azul-marinho, óculos marcados na testa, ombros largos demais para o corpo.",
    pose: "hipshot",
    pele: 3,
    cabelo: { estilo: "careca", cores: ["#1B1B1F", "#2C2A28", "#3E3833"] },
    rosto: { olhos: "determinado", sobrancelha: "neutra", boca: "sorriso", lado: 1, blush: true },
    chapeu: { tipo: "toucaNatacao", cores: ["#1B3C74", "#2B5CA8"], escondeCabelo: true },
    face: { tipo: "oculosNatacao", cores: ["#00E5FF", "#1B3C74"] },
    roupa: { base: "collant", manga: "sem", gola: "alta", cores: ["#1B3C74", "#2B5CA8", "#F0B429"], detalhe: "medalha" },
    baixo: { tipo: "nenhum", cores: [] },
    calcado: { tipo: "descalco", cores: [] },
  },
  {
    id: "av-boxeador-aposentado",
    nome: "Boxeador Aposentado",
    raridade: "incomum",
    descricao: "Nariz torto, orelha de couve-flor, ainda enfaixa as mãos por puro costume.",
    pose: "flex",
    pele: 6,
    cabelo: { estilo: "careca", cores: ["#101014", "#1B1B1F", "#2C2C33"] },
    rosto: {
      olhos: "bravo",
      sobrancelha: "brava",
      boca: "serio",
      lado: -1,
      blush: false,
      barba: { tipo: "cavanhaque", cor: "#1B1B1F" },
    },
    roupa: { base: "roupao", manga: "longa", gola: "v", cores: ["#C0392B", "#8E2117", "#F0B429"], detalhe: "cordao" },
    baixo: { tipo: "shorts", cores: ["#8E2117", "#F0B429"] },
    calcado: { tipo: "bota", cores: ["#C0392B", BRANCO] },
    maoDir: { tipo: "luvaBoxe", cores: ["#C0392B", BRANCO], duasMaos: true },
  },
  {
    id: "av-jogador-sinuca",
    nome: "Jogador de Sinuca",
    raridade: "incomum",
    descricao: "Colete verde-mesa, giz azul no dedo, cigarro apagado atrás da orelha. Nunca perde em casa.",
    pose: "point",
    pele: 2,
    cabelo: { estilo: "curto", cores: ["#2A1E16", "#3A2A20", "#54402F"] },
    rosto: { olhos: "determinado", sobrancelha: "torta", boca: "sorrisoTorto", lado: 1, blush: false },
    roupa: { base: "camisa", manga: "longa", gola: "camisa", cores: [BRANCO, "#1E5B3A", "#F0B429"], detalhe: "colete" },
    baixo: { tipo: "calca", cores: [PRETO] },
    calcado: { tipo: "sapato", cores: [PRETO] },
    maoDir: { tipo: "tacoSinuca", cores: ["#A9793F", "#5A3E1F"] },
  },
  {
    id: "av-halterofilista",
    nome: "Halterofilista",
    raridade: "incomum",
    descricao: "Cinturão de couro, magnésio nas mãos, pescoço da largura da cabeça. Só faz dia de perna.",
    pose: "flex",
    pele: 6,
    cabelo: { estilo: "coque", cores: ["#101014", "#1B1B1F", "#2C2C33"] },
    rosto: { olhos: "determinado", sobrancelha: "brava", boca: "dentes", lado: -1, blush: true },
    roupa: { base: "collant", manga: "sem", gola: "redonda", cores: ["#4A4E57", "#33363D", "#F0B429"], detalhe: "cinturao" },
    baixo: { tipo: "nenhum", cores: [] },
    calcado: { tipo: "bota", cores: [BRANCO, "#4A4E57"] },
    maoDir: { tipo: "halter", cores: [GRAFITE, "#8A8F98"], duasMaos: true },
  },
  {
    id: "av-dj-torcida",
    nome: "DJ da Torcida",
    raridade: "incomum",
    descricao: "Comanda o cântico da geral pelo som. Sabe exatamente quando soltar o grave.",
    pose: "cheer",
    pele: 6,
    cabelo: { estilo: "coque", cores: ["#101014", "#1B1B1F", "#2C2C33"] },
    rosto: { olhos: "piscada", sobrancelha: "erguida", boca: "aberta", lado: 1, blush: true },
    chapeu: { tipo: "headphone", cores: ["#FF3D9A", "#17181B"] },
    roupa: { base: "jaqueta", manga: "longa", gola: "capuz", cores: [PRETO, "#1E1F24", "#FF3D9A"], detalhe: "ziper" },
    baixo: { tipo: "calca", cores: ["#1E1F24"] },
    calcado: { tipo: "tenis", cores: ["#FF3D9A", PRETO] },
  },
  {
    id: "av-reporter-campo",
    nome: "Repórter de Campo",
    raridade: "incomum",
    descricao: "Microfone erguido na beira do gramado, sempre a dois metros da confusão.",
    pose: "point",
    pele: 1,
    cabelo: { estilo: "chanel", cores: ["#2A1E16", "#4A3320", "#6B4423"] },
    rosto: { olhos: "normal", sobrancelha: "erguida", boca: "aberta", lado: -1, blush: true },
    roupa: { base: "jaqueta", manga: "longa", gola: "alta", cores: ["#C0392B", "#8E2117", BRANCO], detalhe: "ziper" },
    baixo: { tipo: "calca", cores: [JEANS_ESCURO] },
    calcado: { tipo: "tenis", cores: [BRANCO, "#C0392B"] },
    maoDir: { tipo: "microfone", cores: [GRAFITE, "#C0392B"] },
  },

  // ================================================================ RAROS (6)
  {
    id: "av-arbitro-vilao",
    nome: "Árbitro Vilão",
    raridade: "raro",
    descricao: "Todo de preto, cartão vermelho já erguido antes do apito. Odiado por unanimidade.",
    pose: "card",
    pele: 6,
    cabelo: { estilo: "curto", cores: ["#101014", "#1B1B1F", "#2C2C33"] },
    rosto: { olhos: "determinado", sobrancelha: "brava", boca: "serio", lado: 1, blush: false },
    roupa: { base: "camisa", manga: "curta", gola: "v", cores: [PRETO, "#25262C", "#C0392B"], detalhe: "numero", numero: 4 },
    baixo: { tipo: "calcao", cores: [PRETO, "#C0392B"] },
    calcado: { tipo: "chuteira", cores: [PRETO, "#C0392B"] },
    maoDir: { tipo: "cartaoVermelho", cores: ["#E5484D", PRETO] },
  },
  {
    id: "av-mascote-tigre",
    nome: "Mascote Tigre",
    raridade: "raro",
    descricao: "Fantasia inteira de tigre. Suando dentro dela desde o aquecimento e ainda dançando.",
    pose: "cheer",
    pele: 1,
    cabelo: { estilo: "careca", cores: ["#8A5A1E", "#B87A2A", "#D89A3A"] },
    rosto: { olhos: "feliz", sobrancelha: "erguida", boca: "dentes", lado: -1, blush: true },
    chapeu: { tipo: "capuzTigre", cores: ["#E08A2E", "#F5D9A8", "#2A1A0E"], escondeCabelo: true },
    roupa: { base: "pelucia", manga: "longa", gola: "alta", cores: ["#E08A2E", "#F5D9A8", "#2A1A0E"], detalhe: "listras" },
    baixo: { tipo: "calca", cores: ["#E08A2E", "#2A1A0E"] },
    calcado: { tipo: "patas", cores: ["#E08A2E", "#F5D9A8"] },
    costas: { tipo: "cauda", cores: ["#E08A2E", "#2A1A0E"] },
  },
  {
    id: "av-piloto-kart",
    nome: "Piloto de Kart",
    raridade: "raro",
    descricao: "Capacete integral com viseira dourada, macacão coberto de patrocínio de oficina do bairro.",
    pose: "thumbsup",
    pele: 2,
    cabelo: { estilo: "careca", cores: ["#1B1B1F", "#2C2A28", "#3E3833"] },
    rosto: { olhos: "normal", sobrancelha: "neutra", boca: "sorriso", lado: 1, blush: false },
    chapeu: { tipo: "capaceteIntegral", cores: ["#E5484D", BRANCO, "#F0B429"], escondeCabelo: true, escondeOlhos: true },
    roupa: { base: "macacao", manga: "longa", gola: "alta", cores: [BRANCO, "#E5484D", "#F0B429"], detalhe: "peitoral" },
    baixo: { tipo: "calca", cores: [BRANCO, "#E5484D"] },
    calcado: { tipo: "bota", cores: ["#E5484D", BRANCO] },
    maoEsq: { tipo: "luvaGoleiro", cores: ["#E5484D", BRANCO] },
  },
  {
    id: "av-xadrezista-sombrio",
    nome: "Xadrezista Sombrio",
    raridade: "raro",
    descricao: "Terno preto, olhar fixo, cronômetro parado na mão. Calcula doze jogadas à frente do seu palpite.",
    pose: "idle",
    pele: 0,
    cabelo: { estilo: "careca", cores: ["#3A3A40", "#55555C", "#6E6E76"] },
    rosto: { olhos: "sereno", sobrancelha: "torta", boca: "serio", lado: -1, blush: false },
    roupa: { base: "terno", manga: "longa", gola: "camisa", cores: [PRETO, "#1E1F24", BRANCO], detalhe: "gravata" },
    baixo: { tipo: "calca", cores: [PRETO] },
    calcado: { tipo: "sapato", cores: [PRETO] },
    maoDir: { tipo: "cronometro", cores: [OSSO, GRAFITE] },
  },
  {
    id: "av-capita-nautica",
    nome: "Capitã Náutica",
    raridade: "raro",
    descricao: "Quepe de capitã, blazer azul-marinho com botões dourados, luneta que nunca sai da mão.",
    pose: "hipshot",
    pele: 2,
    cabelo: { estilo: "chanel", cores: ["#9EA2AA", "#C9CDD4", "#E6E8EC"] },
    rosto: { olhos: "piscada", sobrancelha: "erguida", boca: "sorrisoTorto", lado: 1, blush: true },
    chapeu: { tipo: "quepe", cores: [BRANCO, "#1B3C74", "#F0B429"] },
    roupa: { base: "terno", manga: "longa", gola: "camisa", cores: ["#1B3C74", "#12294F", "#F0B429"], detalhe: "botoes" },
    baixo: { tipo: "calca", cores: [BRANCO] },
    calcado: { tipo: "bota", cores: ["#1B3C74", "#F0B429"] },
    maoDir: { tipo: "luneta", cores: ["#8A6A4A", "#F0B429"] },
  },
  {
    id: "av-ginasta-fita",
    nome: "Ginasta de Fita",
    raridade: "raro",
    descricao: "Coque perfeito, collant com brilho, fita rodando num arco que parece não ter fim.",
    pose: "cheer",
    pele: 1,
    cabelo: { estilo: "coque", cores: ["#2A1E16", "#4A3320", "#6B4423"] },
    rosto: { olhos: "piscada", sobrancelha: "erguida", boca: "sorriso", lado: -1, blush: true },
    roupa: { base: "collant", manga: "sem", gola: "alta", cores: ["#D6209B", "#A0176F", "#F0B429"], detalhe: "medalha" },
    baixo: { tipo: "saia", cores: ["#D6209B", "#F0B429"] },
    calcado: { tipo: "sapatilha", cores: ["#F5D9C0"] },
    maoDir: { tipo: "fita", cores: ["#F0B429", "#D6209B"] },
  },

  // ================================================================ ÉPICOS (3)
  {
    id: "av-ninja-dojo",
    nome: "Ninja do Dojo",
    raridade: "epico",
    descricao: "Só os olhos aparecem. Faixa preta na testa, shuriken entre os dedos. Silencioso até nos palpites.",
    pose: "point",
    pele: 1,
    cabelo: { estilo: "careca", cores: ["#101014", "#1B1B1F", "#2C2C33"] },
    rosto: { olhos: "determinado", sobrancelha: "brava", boca: "serio", lado: 1, blush: false },
    face: { tipo: "mascaraShinobi", cores: ["#1B2333", "#2C3852"] },
    chapeu: { tipo: "bandana", cores: [PRETO, "#C0392B"] },
    roupa: { base: "jaqueta", manga: "longa", gola: "alta", cores: ["#1B2333", "#111826", "#C0392B"], detalhe: "cinturao" },
    baixo: { tipo: "calca", cores: ["#111826"] },
    calcado: { tipo: "bota", cores: ["#1B2333", "#C0392B"] },
    maoDir: { tipo: "shuriken", cores: ["#C9CDD4", "#8A8F98"] },
    aura: "#4C8DFF",
  },
  {
    id: "av-bruxa-sorte",
    nome: "Bruxa da Sorte",
    raridade: "epico",
    descricao: "Chapéu pontudo torto, poção borbulhando na mão. Diz que prevê resultados — e às vezes acerta.",
    pose: "cast",
    pele: 0,
    cabelo: { estilo: "longo", cores: ["#2A1240", "#4A1F6B", "#7C3FB0"] },
    rosto: { olhos: "piscada", sobrancelha: "torta", boca: "sorrisoTorto", lado: -1, blush: true },
    chapeu: { tipo: "chapeuBruxa", cores: ["#5B21A8", "#3A1470", "#F0B429"] },
    roupa: { base: "vestido", manga: "longa", gola: "alta", cores: ["#5B21A8", "#3A1470", "#F0B429"], detalhe: "cordao" },
    baixo: { tipo: "calca", cores: ["#2A1240"] },
    calcado: { tipo: "bota", cores: ["#2A1240", "#F0B429"] },
    maoDir: { tipo: "pocao", cores: ["#3FBE7B", "#C9CDD4"] },
    aura: "#A855F7",
  },
  {
    id: "av-astronauta-perdido",
    nome: "Astronauta Perdido",
    raridade: "epico",
    descricao: "Visor dourado refletindo o estádio inteiro. Traje pressurizado. Não faz ideia de onde pousou.",
    pose: "peace",
    pele: 1,
    cabelo: { estilo: "careca", cores: ["#3A2A20", "#54402F", "#6B4423"] },
    rosto: { olhos: "surpreso", sobrancelha: "erguida", boca: "bico", lado: 1, blush: true },
    chapeu: { tipo: "capaceteEspacial", cores: [BRANCO, "#F0B429", "#C9CDD4"], escondeCabelo: true },
    face: { tipo: "visorDourado", cores: ["#F0B429"], escondeOlhos: true },
    roupa: { base: "espacial", manga: "longa", gola: "alta", cores: [BRANCO, "#D9DCE2", "#E5484D"], detalhe: "peitoral" },
    baixo: { tipo: "calca", cores: [BRANCO, "#D9DCE2"] },
    calcado: { tipo: "bota", cores: [BRANCO, "#8A8F98"] },
    costas: { tipo: "mochilaEspacial", cores: ["#C9CDD4", "#8A8F98"] },
    aura: "#7FD1C1",
  },

  // ============================================================= LENDÁRIO (1)
  {
    id: "av-rei-bolao",
    nome: "Rei do Bolão",
    raridade: "lendario",
    descricao: "Coroa torta de tanto usar, manto de veludo arrastando, cetro com bola dourada. Invicto há três temporadas.",
    pose: "scepter",
    pele: 1,
    cabelo: { estilo: "longo", cores: ["#8A6A20", "#C79A2E", "#F0CB6A"] },
    rosto: {
      olhos: "sereno",
      sobrancelha: "erguida",
      boca: "sorrisoTorto",
      lado: -1,
      blush: true,
      barba: { tipo: "cheia", cor: "#E6D2A0" },
    },
    chapeu: { tipo: "coroa", cores: ["#F0B429", "#C0392B", "#FFE08A"] },
    roupa: { base: "manto", manga: "longa", gola: "alta", cores: ["#7A1533", "#5A0E24", "#F0B429"], detalhe: "peitoral" },
    baixo: { tipo: "calca", cores: ["#5A0E24"] },
    calcado: { tipo: "bota", cores: ["#F0B429", "#7A1533"] },
    costas: { tipo: "capa", cores: ["#7A1533", "#F0CB6A"] },
    maoDir: { tipo: "cetro", cores: ["#F0B429", "#7A1533"] },
    aura: "#F0B429",
  },
];

export const AVATAR_POR_ID: ReadonlyMap<string, AvatarCatalogo> = new Map(
  AVATARES.map((a) => [a.id, a]),
);

export function avatar(id: string): AvatarCatalogo | undefined {
  return AVATAR_POR_ID.get(id);
}

export function precoAvatar(a: AvatarCatalogo): number {
  return PRECO_AVATAR[a.raridade];
}

/** Na ordem da pirâmide, que é a ordem em que a loja mostra. */
export const AVATARES_POR_RARIDADE: ReadonlyArray<[Raridade, AvatarCatalogo[]]> = (
  ["comum", "incomum", "raro", "epico", "lendario"] as const
).map((r) => [r, AVATARES.filter((a) => a.raridade === r)]);

export type { Raridade };
