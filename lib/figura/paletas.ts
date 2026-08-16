// Paletas do corpo do personagem.
//
// EXCEÇÃO DECLARADA AO "ZERO HEX FORA DOS TOKENS" (ver ROLLBACK.md). Aqui a cor
// é o DADO, não cromo de interface: são tons de pele e de cabelo de gente, e
// mapear isso para `--c-accent` colapsaria oito tons distinguíveis num só.
// Mesma justificativa de `lib/escalacao/cores.ts` e `FiguraBuilder`, que já
// carregavam tons de pele em hex.
//
// A figura salva guarda o ÍNDICE, não o hex. Isso torna a validação do servidor
// uma checagem de faixa (0 <= i < length) em vez de regex de cor, e permite
// reafinar um tom sem reescrever o banco.

export const PELES = [
  "#F6D9C0",
  "#EDBE9A",
  "#D9A278",
  "#C08457",
  "#9C6644",
  "#7A4B2E",
  "#5A351F",
  "#3B2416",
] as const;

export const CABELOS = [
  "#1B1B1F",
  "#3A2A20",
  "#6B4423",
  "#A9793F",
  "#D8B26A",
  "#E8E3D9",
  "#8A8F98",
  "#C0392B",
  "#7C5CFC",
  "#2E9E63",
] as const;

export const CABELO_ESTILOS = [
  { id: "careca", nome: "Careca" },
  { id: "curto", nome: "Curto" },
  { id: "espetado", nome: "Espetado" },
  { id: "moicano", nome: "Moicano" },
  { id: "afro", nome: "Black power" },
  { id: "longo", nome: "Longo" },
  { id: "rabo", nome: "Rabo de cavalo" },
  { id: "franja", nome: "Franja" },
  { id: "coque", nome: "Coque" },
  { id: "dread", nome: "Dreads" },
  { id: "undercut", nome: "Undercut" },
  { id: "chanel", nome: "Chanel" },
] as const;

export const CORPOS = [
  { id: 0, nome: "Magro" },
  { id: 1, nome: "Médio" },
  { id: 2, nome: "Forte" },
] as const;

export const OLHOS = [
  { id: "normal", nome: "Normal" },
  { id: "feliz", nome: "Feliz" },
  { id: "bravo", nome: "Bravo" },
  { id: "sono", nome: "Sono" },
  { id: "estrela", nome: "Estrela" },
  { id: "surpreso", nome: "Surpreso" },
  { id: "fechado", nome: "Fechado" },
  { id: "ciclope", nome: "Ciclope" },
] as const;

export const BOCAS = [
  { id: "sorriso", nome: "Sorriso" },
  { id: "serio", nome: "Sério" },
  { id: "aberto", nome: "Aberto" },
  { id: "torto", nome: "Sorriso torto" },
  { id: "bico", nome: "Bico" },
  { id: "dentes", nome: "Dentão" },
  { id: "triste", nome: "Triste" },
  { id: "lingua", nome: "Língua" },
] as const;

export const SOBRANCELHAS = [
  { id: "normal", nome: "Normal" },
  { id: "brava", nome: "Brava" },
  { id: "alta", nome: "Levantada" },
  { id: "fina", nome: "Fina" },
  { id: "grossa", nome: "Grossa" },
  { id: "unica", nome: "Monocelha" },
] as const;

export const BARBAS = [
  { id: "nenhuma", nome: "Sem barba" },
  { id: "cavanhaque", nome: "Cavanhaque" },
  { id: "bigode", nome: "Bigode" },
  { id: "cheia", nome: "Cheia" },
  { id: "costeleta", nome: "Costeleta" },
  { id: "bode", nome: "Barbicha" },
] as const;

/** Cor por raridade — escala categórica, como o RankBadge. Não é token de tema. */
export const COR_RARIDADE: Record<string, string> = {
  comum: "#8A8F98",
  incomum: "#3FBE7B",
  raro: "#4C8DFF",
  epico: "#A855F7",
  lendario: "#F0B429",
};

export const NOME_RARIDADE: Record<string, string> = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
};
