// Catálogo dos avatares do KIT oficial (Enrico, 21/08/2026) — paralelo aos 30
// av-* procedurais em `avatares.ts`. Os do kit são .glb pré-cozidos com textura
// + rig embutidos, renderizados via <model-viewer> (web component do Google),
// não pelo editor de partes.
//
// Fonte da verdade: public/avatares/kit/manifest.json.
// NÃO renomear arquivos aqui sem atualizar o manifest.

export type RaridadeKit = "comum" | "raro" | "lendario";

export type AvatarKit = {
  id: "capitao" | "analista" | "craque" | "raiz" | "cyber";
  nome: string;
  vibe: string;
  assinatura: string;
  glb: string;      // caminho absoluto pronto pra <model-viewer src>
  poster?: string;  // PNG 1024px pra painting instantâneo (opcional — sem poster mostra fundo do model-viewer)
  raridade: RaridadeKit;
};

export type ColecionavelKit = {
  id: string;
  nome: string;
  personagem: AvatarKit["id"];
  arquivo: string;
  raridade: RaridadeKit;
  variantePostura?: boolean;
};

const BASE = "/avatares/kit";

export const AVATARES_KIT: AvatarKit[] = [
  {
    id: "capitao",
    nome: "O Capitão",
    vibe: "o líder do bolão",
    assinatura: "Z bordado no boné + pinstripes na manga do corta-vento",
    glb: `${BASE}/3d/capitao.glb`,
    poster: `${BASE}/2d/01_capitao_Z.png`,
    raridade: "comum",
  },
  {
    id: "analista",
    nome: "O Analista",
    vibe: "o nerd dos dados que sempre acerta",
    assinatura: "Z estampado no peito do moletom + trend-line no bolso",
    glb: `${BASE}/3d/analista.glb`,
    poster: `${BASE}/2d/02_analista_Z.png`,
    raridade: "comum",
  },
  {
    id: "craque",
    nome: "A Craque",
    vibe: "joga mais que você",
    assinatura: "Z como escudo do uniforme + listra no shorts",
    glb: `${BASE}/3d/craque.glb`,
    poster: `${BASE}/2d/03_craque_Z.png`,
    raridade: "comum",
  },
  {
    id: "raiz",
    nome: "O Raiz",
    vibe: "a arquibancada em pessoa",
    assinatura: "Z tecido no cachecol de torcida",
    glb: `${BASE}/3d/raiz.glb`,
    poster: `${BASE}/2d/04_raiz_Z.png`,
    raridade: "comum",
  },
  {
    id: "cyber",
    nome: "O Cyber",
    vibe: "o prodígio dos e-sports",
    assinatura: "patch Z na bomber + vivo ciano no zíper",
    glb: `${BASE}/3d/cyber.glb`,
    poster: `${BASE}/2d/05_cyber_Z.png`,
    raridade: "comum",
  },
];

export const COLECIONAVEIS_KIT: ColecionavelKit[] = [
  { id: "capitao_bracadeira", nome: "Braçadeira de Capitão", personagem: "capitao", arquivo: `${BASE}/colecionaveis/capitao_bracadeira.png`, raridade: "comum" },
  { id: "capitao_trofeu",     nome: "Troféu do Bolão",       personagem: "capitao", arquivo: `${BASE}/colecionaveis/capitao_trofeu.png`,     raridade: "comum" },
  { id: "analista_oculos",    nome: "Óculos do Analista",    personagem: "analista", arquivo: `${BASE}/colecionaveis/analista_oculos.png`,    raridade: "comum" },
  { id: "analista_tablet",    nome: "Tablet de Estatísticas", personagem: "analista", arquivo: `${BASE}/colecionaveis/analista_tablet.png`,    raridade: "comum" },
  { id: "craque_bola",        nome: "Bola Clássica",         personagem: "craque",   arquivo: `${BASE}/colecionaveis/craque_bola.png`,        raridade: "comum" },
  { id: "craque_chuteira",    nome: "Chuteira Dourada",      personagem: "craque",   arquivo: `${BASE}/colecionaveis/craque_chuteira.png`,    raridade: "raro" },
  { id: "raiz_cachecol",      nome: "Cachecol da Torcida",   personagem: "raiz",     arquivo: `${BASE}/colecionaveis/raiz_cachecol.png`,      raridade: "comum" },
  { id: "raiz_corneta",       nome: "Corneta do Estádio",    personagem: "raiz",     arquivo: `${BASE}/colecionaveis/raiz_corneta.png`,       raridade: "comum" },
  { id: "cyber_headset",      nome: "Headset Ciano",         personagem: "cyber",    arquivo: `${BASE}/colecionaveis/cyber_headset.png`,      raridade: "comum" },
  { id: "cyber_gamepad",      nome: "Gamepad Neon",          personagem: "cyber",    arquivo: `${BASE}/colecionaveis/cyber_gamepad.png`,      raridade: "comum" },
  {
    id: "capitao_surf_pose",
    nome: "Prancha de Surf (variante de postura)",
    personagem: "capitao",
    arquivo: `${BASE}/colecionaveis/01_capitao_SURF_prova.png`,
    raridade: "raro",
    variantePostura: true,
  },
];

export function avatarKitPorId(id: string): AvatarKit | undefined {
  return AVATARES_KIT.find((a) => a.id === id);
}
