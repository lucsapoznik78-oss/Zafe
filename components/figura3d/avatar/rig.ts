// O esqueleto do avatar: proporções 31/24/45 e as dez poses.
//
// POR QUE ESTAS MEDIDAS NÃO SÃO AS DE `primitivas.ts`
//
// O boneco montável usa cabeça em ~38% da altura. A v2 do cast baixa para 31%
// (doc §3) por um motivo prático, não estético: com a cabeça ocupando quase
// dois quintos do corpo, o torso fica com 20cm de tela e não cabe gola, bainha,
// bolso nem número — toda roupa vira o mesmo retângulo colorido. Perna longa é
// o que abre espaço para a pose deslocar o peso sem o personagem virar um saco.
//
// As duas geometrias convivem: o avatar pronto é um objeto FECHADO (compra-se
// inteiro), então ele não precisa encaixar nos acessórios do boneco montável, e
// pode ter a proporção certa para si.
//
// CONVENÇÃO DE EIXOS, igual à do resto do app: Y é altura, pés em y=0, o
// personagem olha para +Z. X negativo é a direita DELE (a esquerda de quem
// olha) — é por isso que `lado: -1` no catálogo significa "olho direito".

/** Altura total, do chão ao topo do crânio. */
export const ALTURA = 2.86;

const CABECA = ALTURA * 0.31;
const TORSO_A = ALTURA * 0.24;
const PERNA_A = ALTURA * 0.45;

export const R = {
  altura: ALTURA,

  /** Lado do cubo da cabeça. */
  cabeca: CABECA,
  /** Metade — usado o tempo todo para achar superfície. */
  meiaCabeca: CABECA / 2,

  torsoL: 0.62,
  torsoP: 0.34,
  torsoA: TORSO_A,

  /** Pescoço curto mas VISÍVEL: cabeça assentada no ombro é erro declarado. */
  pescocoA: 0.1,
  pescocoR: 0.11,

  /** Braço: dois segmentos, para o cotovelo poder dobrar. */
  bracoR: 0.075,
  bracoA: 0.3,
  antebracoA: 0.28,

  pernaR: 0.1,
  pernaA: PERNA_A,
  coxaA: PERNA_A * 0.52,
  canelaA: PERNA_A * 0.48,

  /** Y do centro do tronco. */
  yTorso: PERNA_A + TORSO_A / 2,
  /** Y do ombro — origem da cadeia do braço. */
  yOmbro: PERNA_A + TORSO_A - 0.05,
  /** Y do quadril — origem da cadeia da perna. */
  yQuadril: PERNA_A,
  /** Y do centro da cabeça. */
  yCabeca: PERNA_A + TORSO_A + 0.1 + CABECA / 2,
  /** Y do topo do crânio. */
  yTopo: PERNA_A + TORSO_A + 0.1 + CABECA,

  /** X do ombro (positivo; multiplicar por ±1). */
  xOmbro: 0.62 / 2 + 0.075,
  /** X do quadril. */
  xQuadril: 0.15,

  /** Z da face do rosto e das costas. */
  zRosto: CABECA / 2,
  zCostas: -0.34 / 2,
} as const;

export type Rig = typeof R;

/** Comprimento total do braço, do ombro à ponta da mão. */
export const BRACO_TOTAL = R.bracoA + R.antebracoA + 0.12;

type Giro = [number, number, number];

/**
 * Uma pose é só um punhado de rotações.
 *
 * Cada cadeia gira no PRÓPRIO ponto de origem (ombro, cotovelo, quadril,
 * joelho), e a geometria dentro dela é desenhada pendurada a partir do zero.
 * Isso é o que faz o prop na mão acompanhar o braço sem nenhuma conta: ele é
 * filho do mesmo grupo.
 *
 * `quadril` e `tronco` inclinam o corpo inteiro — é onde mora o "peso do corpo
 * se desloca para uma perna" do hipshot. Sem essa inclinação a pose vira só um
 * braço torto num manequim reto.
 */
export type Pose3D = {
  /** Ombro direito do personagem (x negativo). */
  ombroDir: Giro;
  cotoveloDir: Giro;
  ombroEsq: Giro;
  cotoveloEsq: Giro;
  quadrilDir: Giro;
  quadrilEsq: Giro;
  /** Inclinação lateral do tronco, em radianos. */
  tronco: Giro;
  /** Inclinação da cabeça. */
  cabeca: Giro;
  /** Deslocamento lateral do quadril — o apoio do hipshot. */
  desvioQuadril: number;
  /** Mão aberta ou fechada em punho, por lado. Prop na mão força fechada. */
  punhoDir?: boolean;
  punhoEsq?: boolean;
};

const RETO: Pose3D = {
  ombroDir: [0, 0, 0.12],
  cotoveloDir: [0, 0, 0],
  ombroEsq: [0, 0, -0.12],
  cotoveloEsq: [0, 0, 0],
  quadrilDir: [0, 0, 0],
  quadrilEsq: [0, 0, 0],
  tronco: [0, 0, 0],
  cabeca: [0, 0, 0],
  desvioQuadril: 0,
};

/**
 * As dez poses. Nenhuma simétrica — está na especificação, e é a diferença
 * entre um cast e dez cópias do mesmo manequim.
 *
 * Os números saíram de tentativa e erro no canvas, não de uma fórmula. O que
 * importa manter: o braço que segura o prop nunca fica colado no corpo (o prop
 * atravessaria o torso), e o tronco sempre acompanha o gesto em algum grau.
 */
export const POSE_3D: Record<string, Pose3D> = {
  // Parado, mas com PESO. A versão anterior desta pose mexia no máximo 0,16 rad
  // (9°) e por isso não era uma pose: era A-pose com ruído. Num card de 96px o
  // olho não resolve 9°, então quatro personagens em `idle` liam como o mesmo
  // boneco pintado de cores diferentes — que é exatamente o que mata o valor de
  // comprar o segundo avatar.
  //
  // Agora o peso vai para uma perna de verdade (quadril desloca, tronco
  // compensa, ombros desnivelam). Continua sendo a pose discreta do cast — quem
  // quer o gesto grande usa `hipshot`, que põe a mão na cintura —, mas a
  // silhueta já não é a de um manequim.
  idle: {
    ...RETO,
    ombroDir: [0.18, 0, 0.2],
    cotoveloDir: [0.55, -0.1, 0.06],
    ombroEsq: [-0.12, 0, -0.13],
    cotoveloEsq: [0.22, 0, 0],
    quadrilDir: [0.05, 0, -0.04],
    quadrilEsq: [-0.1, 0, 0.07],
    tronco: [0.01, 0.09, -0.045],
    cabeca: [0.04, 0.14, 0.06],
    desvioQuadril: 0.045,
  },

  // O clássico: peso todo numa perna, quadril jogado, mão na cintura.
  hipshot: {
    ...RETO,
    ombroDir: [0, 0, 0.1],
    cotoveloDir: [0, -1.15, 0.55],
    ombroEsq: [0.12, 0, -0.2],
    cotoveloEsq: [0.3, 0, 0],
    quadrilDir: [0, 0, -0.06],
    quadrilEsq: [-0.06, 0, 0.1],
    tronco: [0, -0.1, 0.07],
    cabeca: [0, -0.14, -0.06],
    desvioQuadril: 0.07,
    punhoDir: true,
  },

  // Os dois braços para o alto, um mais que o outro.
  cheer: {
    ...RETO,
    ombroDir: [0, 0, 2.5],
    cotoveloDir: [0, 0, 0.2],
    ombroEsq: [0, 0, -2.1],
    cotoveloEsq: [0, 0, -0.35],
    quadrilEsq: [-0.14, 0, 0.05],
    tronco: [0.04, 0.05, 0],
    cabeca: [-0.08, -0.06, 0.05],
    desvioQuadril: -0.02,
  },

  // Aponta para a frente e para fora, com o corpo indo junto.
  point: {
    ...RETO,
    ombroDir: [-1.35, -0.4, 0.15],
    cotoveloDir: [-0.15, 0, 0],
    ombroEsq: [0.15, 0, -0.16],
    cotoveloEsq: [0.5, 0, 0],
    tronco: [0, 0.16, -0.03],
    cabeca: [0.02, -0.05, 0.03],
    desvioQuadril: 0.03,
  },

  // Joinha: cotovelo colado, punho na altura do peito.
  thumbsup: {
    ...RETO,
    ombroDir: [-0.5, 0, 0.5],
    cotoveloDir: [-1.5, 0.2, 0],
    ombroEsq: [0.08, 0, -0.14],
    cotoveloEsq: [0.4, 0, 0],
    tronco: [0, -0.08, 0.02],
    cabeca: [-0.04, 0.08, -0.05],
    desvioQuadril: -0.03,
    punhoDir: true,
  },

  // Dois dedos ao lado do rosto.
  peace: {
    ...RETO,
    ombroDir: [-0.35, 0, 1.9],
    cotoveloDir: [-0.5, 0, 0.35],
    ombroEsq: [0.1, 0, -0.22],
    cotoveloEsq: [0.55, 0, 0],
    tronco: [0, 0.08, -0.04],
    cabeca: [-0.05, 0.06, 0.08],
    desvioQuadril: 0.04,
  },

  // Bíceps: os dois cotovelos fechados para cima, ombros abertos.
  flex: {
    ...RETO,
    ombroDir: [-0.2, 0, 1.5],
    cotoveloDir: [-0.3, 0, 1.5],
    ombroEsq: [-0.2, 0, -1.35],
    cotoveloEsq: [-0.3, 0, -1.6],
    quadrilDir: [0, 0, -0.1],
    quadrilEsq: [0, 0, 0.1],
    tronco: [0.03, 0, 0],
    cabeca: [0, 0.12, -0.06],
    desvioQuadril: 0,
    punhoDir: true,
    punhoEsq: true,
  },

  // Cartão erguido bem acima da cabeça, tronco girado para o "culpado".
  card: {
    ...RETO,
    ombroDir: [-0.15, 0, 2.75],
    cotoveloDir: [0, 0, 0.1],
    ombroEsq: [-0.9, -0.5, -0.3],
    cotoveloEsq: [-0.2, 0, 0],
    tronco: [0, 0.2, -0.04],
    cabeca: [-0.06, -0.12, 0.05],
    desvioQuadril: 0.03,
    punhoDir: true,
  },

  // Conjura: uma mão à frente e para cima, a outra recolhida.
  cast: {
    ...RETO,
    ombroDir: [-1.9, -0.55, 0.35],
    cotoveloDir: [-0.45, 0, 0.2],
    ombroEsq: [0.6, 0.3, -0.5],
    cotoveloEsq: [-1.1, 0, 0],
    tronco: [0.02, 0.14, -0.06],
    cabeca: [-0.1, -0.08, 0.07],
    desvioQuadril: 0.05,
    punhoDir: true,
  },

  // Mão junto à orelha. Existe por causa do prop, não por variedade: rádio de
  // pilha e celular pendurados na coxa não são rádio nem celular, são um
  // tijolinho — e a descrição do card promete "colado no ouvido".
  ouvido: {
    ...RETO,
    ombroDir: [-0.2, -0.12, 1.45],
    cotoveloDir: [-0.5, 0, 1.05],
    ombroEsq: [0.1, 0, -0.16],
    cotoveloEsq: [0.42, 0, 0],
    quadrilEsq: [-0.07, 0, 0.06],
    tronco: [0, 0.05, 0.04],
    cabeca: [0.03, 0.07, 0.11],
    desvioQuadril: 0.04,
    punhoDir: true,
  },

  // Luneta no olho: antebraço dobrado à frente do rosto, tronco girado para
  // onde se olha. Mesmo motivo do `ouvido` — o prop define a pose.
  mirar: {
    ...RETO,
    ombroDir: [-0.85, -0.2, 0.42],
    cotoveloDir: [-1.85, 0.3, 0.15],
    ombroEsq: [0.14, 0, -0.3],
    cotoveloEsq: [-0.35, 0, 0],
    quadrilDir: [0, 0, -0.05],
    tronco: [0.02, -0.12, 0.03],
    cabeca: [-0.02, -0.06, -0.03],
    desvioQuadril: -0.04,
    punhoDir: true,
  },

  // Cetro plantado no chão ao lado, postura ereta de retrato oficial.
  scepter: {
    ...RETO,
    ombroDir: [0, 0, 0.32],
    cotoveloDir: [-0.25, 0, 0],
    ombroEsq: [0.05, 0, -0.35],
    cotoveloEsq: [-0.9, 0.4, 0],
    tronco: [-0.02, -0.05, 0],
    cabeca: [-0.05, 0.05, 0.02],
    desvioQuadril: 0,
    punhoDir: true,
  },
};

export function pose3d(nome: string): Pose3D {
  return POSE_3D[nome] ?? POSE_3D.idle;
}

/** Escurece um hex por um fator. É a linha de AO das dobras e bainhas. */
export function sombra(hex: string, f = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Clareia — banda de brilho no cabelo, rim light pintado nas peças grandes. */
export function luz(hex: string, f = 0.25): string {
  const n = parseInt(hex.slice(1), 16);
  const m = (c: number) => Math.round(c + (255 - c) * f);
  return `#${((m((n >> 16) & 255) << 16) | (m((n >> 8) & 255) << 8) | m(n & 255))
    .toString(16)
    .padStart(6, "0")}`;
}
