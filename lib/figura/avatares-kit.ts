// Catálogo dos avatares do KIT oficial (Enrico, 21/08/2026) — paralelo aos 30
// av-* procedurais em `avatares.ts`. Os do kit são .glb pré-cozidos com textura
// + rig embutidos, renderizados via <model-viewer> (web component do Google),
// não pelo editor de partes.
//
// Fonte da verdade: public/avatares/kit/manifest.json.
// NÃO renomear arquivos aqui sem atualizar o manifest.

export type RaridadeKit = "comum" | "raro" | "lendario";

export type AvatarKit = {
  id:
    | "capitao" | "analista" | "craque" | "raiz" | "cyber"
    // Leva 1 Hyper3D (22/08/26 comuns): 6 personagens gerados no Hyper3D e
    // separados por análise de ilhas + K-means espacial (sem poster 2D).
    | "hyper1" | "hyper2" | "hyper3" | "hyper4" | "hyper5" | "hyper6"
    // Leva 2 Hyper3D (22/08/26 raros): mesmo pipeline, 3D_raros.glb.
    // 7 personagens (3 top + 4 bottom no palco original).
    | "raro1" | "raro2" | "raro3" | "raro4" | "raro5" | "raro6" | "raro7";
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
  // ─── Leva 1 Hyper3D (22/08/26) ───
  // O Hyper3D exportou os 6 fundidos num único mesh atlas. A separação foi
  // feita por análise de ilhas conexas + K-means espacial (3 colunas × 2
  // fileiras) — ver scripts em /tmp/split_glb_kmeans.mjs. Nomes são um
  // palpite pelo visual do palco original; se algum estiver trocado, é só
  // renomear aqui.
  {
    id: "hyper1",
    nome: "O Surfista",
    vibe: "verão o ano inteiro",
    assinatura: "prancha embaixo do braço",
    glb: `${BASE}/3d/hyper1.glb`,
    poster: `${BASE}/2d/hyper1.png`,
    raridade: "comum",
  },
  {
    id: "hyper2",
    nome: "O Boxeador",
    vibe: "postura de ringue",
    assinatura: "luvas vermelhas + short com Z",
    glb: `${BASE}/3d/hyper2.glb`,
    poster: `${BASE}/2d/hyper2.png`,
    raridade: "comum",
  },
  {
    id: "hyper3",
    nome: "O Camisa 10",
    vibe: "atacante que decide",
    assinatura: "uniforme vermelho com Z no peito",
    glb: `${BASE}/3d/hyper3.glb`,
    poster: `${BASE}/2d/hyper3.png`,
    raridade: "comum",
  },
  {
    id: "hyper4",
    nome: "A Basqueteira",
    vibe: "cesta na cara do adversário",
    assinatura: "regata + bola de basquete",
    glb: `${BASE}/3d/hyper4.glb`,
    poster: `${BASE}/2d/hyper4.png`,
    raridade: "comum",
  },
  {
    id: "hyper5",
    nome: "A Voleibolista",
    vibe: "saque e bloqueio",
    assinatura: "headphones azul + bola de vôlei",
    glb: `${BASE}/3d/hyper5.glb`,
    poster: `${BASE}/2d/hyper5.png`,
    raridade: "comum",
  },
  {
    id: "hyper6",
    nome: "O Skatista",
    vibe: "manobra na pista",
    assinatura: "capacete azul + shape",
    glb: `${BASE}/3d/hyper6.glb`,
    poster: `${BASE}/2d/hyper6.png`,
    raridade: "comum",
  },
  // ─── Leva 2 Hyper3D — RAROS (22/08/26) ───
  // Mesmo pipeline de separação (union-find + K-means K=7). O palco original
  // tinha 3 no topo + 4 embaixo — no primeiro corte com K=6 skatista e F1
  // colaram no mesmo cluster. Nomes vêm do visual do palco.
  {
    id: "raro1",
    nome: "O Bicicleta",
    vibe: "chute de bicicleta",
    assinatura: "meia com bola no ar",
    glb: `${BASE}/3d/raro1.glb`,
    poster: `${BASE}/2d/raro1.png`,
    raridade: "raro",
  },
  {
    id: "raro2",
    nome: "O Tenista",
    vibe: "backhand cruzado",
    assinatura: "raquete + bolinha amarela",
    glb: `${BASE}/3d/raro2.glb`,
    poster: `${BASE}/2d/raro2.png`,
    raridade: "raro",
  },
  {
    id: "raro3",
    nome: "O Freestyler",
    vibe: "manobra invertida",
    assinatura: "boné Z de ponta-cabeça",
    glb: `${BASE}/3d/raro3.glb`,
    poster: `${BASE}/2d/raro3.png`,
    raridade: "raro",
  },
  {
    id: "raro4",
    nome: "O Streamer",
    vibe: "campanha marathon",
    assinatura: "headset roxo + controle",
    glb: `${BASE}/3d/raro4.glb`,
    poster: `${BASE}/2d/raro4.png`,
    raridade: "raro",
  },
  {
    id: "raro5",
    nome: "O Skatista Pro",
    vibe: "grinda no corrimão",
    assinatura: "boné preto + shape na mão",
    glb: `${BASE}/3d/raro5.glb`,
    poster: `${BASE}/2d/raro5.png`,
    raridade: "raro",
  },
  {
    id: "raro6",
    nome: "O Piloto",
    vibe: "pole position",
    assinatura: "macacão + capacete + kart",
    glb: `${BASE}/3d/raro6.glb`,
    poster: `${BASE}/2d/raro6.png`,
    raridade: "raro",
  },
  {
    id: "raro7",
    nome: "O Xadrezista",
    vibe: "xeque-mate em três",
    assinatura: "coroa + tabuleiro",
    glb: `${BASE}/3d/raro7.glb`,
    poster: `${BASE}/2d/raro7.png`,
    raridade: "raro",
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
