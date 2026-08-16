// Geometrias e materiais compartilhados por TODO o personagem.
//
// POR QUE ISTO EXISTE
//
// Um personagem vestido chega a ~40 malhas. Se cada uma criar a própria
// `BoxGeometry` e o próprio `Material` dentro do corpo do componente, o React
// recria os dois a cada render — e material novo é objeto novo de GPU, que o
// three não consegue agrupar e o navegador não consegue liberar até o GC
// passar. Girar o boneco viraria um vazamento contínuo de memória de vídeo.
//
// A saída é ter UMA caixa 1×1×1, UMA esfera e UM cilindro para o app inteiro,
// escalados por malha (`scale`), e um cache de material por cor. Material é
// caro; `scale` é de graça.
//
// Nada aqui é liberado: o cache é do módulo, vive enquanto a aba viver, e é
// justamente isso que queremos — trocar de aba não pode recomprar geometria.

import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  MeshLambertMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";

/** Caixa unitária centrada na origem. Escalada por malha — nunca recriada. */
export const CAIXA = new BoxGeometry(1, 1, 1);
export const ESFERA = new SphereGeometry(0.5, 16, 12);
export const CILINDRO = new CylinderGeometry(0.5, 0.5, 1, 16);
export const CONE = new ConeGeometry(0.5, 1, 16);
export const CAPSULA = new CapsuleGeometry(0.5, 1, 4, 12);
export const TORUS = new TorusGeometry(0.5, 0.15, 8, 20);
export const DISCO = new CircleGeometry(0.5, 24);

/**
 * Material por cor.
 *
 * `MeshLambertMaterial` e não `MeshStandardMaterial`: o Standard é PBR, calcula
 * por pixel e custa caro em GPU de celular. Num boneco de blocos chapados a
 * diferença visual é quase nada e o ganho é grande.
 */
const materiais = new Map<string, MeshLambertMaterial>();

export function material(cor: string): MeshLambertMaterial {
  let m = materiais.get(cor);
  if (!m) {
    m = new MeshLambertMaterial({ color: cor });
    materiais.set(cor, m);
  }
  return m;
}

/** Variante translúcida — sombra de contato, auras, viseira. */
const transparentes = new Map<string, MeshLambertMaterial>();

export function materialTransparente(cor: string, opacidade: number): MeshLambertMaterial {
  const chave = `${cor}@${opacidade}`;
  let m = transparentes.get(chave);
  if (!m) {
    m = new MeshLambertMaterial({
      color: cor,
      transparent: true,
      opacity: opacidade,
      depthWrite: false,
    });
    transparentes.set(chave, m);
  }
  return m;
}

// -------------------------------------------------------------------------
// MEDIDAS
//
// Um sistema de coordenadas só, combinado uma vez: Y é altura, os pés ficam em
// y=0 e o personagem olha para +Z. Todo item lê daqui em vez de chutar posição
// — sem isso, trocar "magro" por "forte" descolaria o boné da cabeça, porque
// cada acessório teria embutido um palpite diferente de onde a cabeça está.
// -------------------------------------------------------------------------

export type Medidas = {
  /** Largura do tronco (X). */
  torsoL: number;
  /** Profundidade do tronco (Z). */
  torsoP: number;
  /** Altura do tronco. */
  torsoA: number;
  /** Lado do cubo da cabeça. */
  cabeca: number;
  /** Espessura do braço. */
  braco: number;
  /** Comprimento do braço. */
  bracoA: number;
  /** Espessura da perna. */
  perna: number;
  /** Comprimento da perna, do chão ao quadril. */
  pernaA: number;
  /** Y do centro do tronco. */
  yTorso: number;
  /** Y do centro da cabeça. */
  yCabeca: number;
  /** Y do topo do crânio. */
  yTopo: number;
  /** Y da mão (ponta do braço). */
  yMao: number;
  /** X da mão direita do personagem (negativo: ele encara a câmera). */
  xMao: number;
  /** Z da face do rosto. */
  zRosto: number;
  /** Z das costas. */
  zCostas: number;
};

function medir(torsoL: number, torsoP: number, braco: number, perna: number): Medidas {
  const pernaA = 0.95;
  const torsoA = 0.95;
  const cabeca = 0.78;
  const bracoA = 0.9;
  const yTorso = pernaA + torsoA / 2;
  const yCabeca = pernaA + torsoA + cabeca / 2 + 0.06;
  return {
    torsoL,
    torsoP,
    torsoA,
    cabeca,
    braco,
    bracoA,
    perna,
    pernaA,
    yTorso,
    yCabeca,
    yTopo: yCabeca + cabeca / 2,
    yMao: pernaA + torsoA - bracoA + 0.05,
    xMao: -(torsoL / 2 + braco / 2 + 0.02),
    zRosto: cabeca / 2,
    zCostas: -torsoP / 2,
  };
}

/** Índice = campo `corpo` da figura (0 magro, 1 médio, 2 forte). */
export const MEDIDAS: readonly Medidas[] = [
  medir(0.7, 0.4, 0.15, 0.2),
  medir(0.86, 0.48, 0.19, 0.24),
  medir(1.04, 0.58, 0.24, 0.28),
];

export function medidasDe(corpo: number): Medidas {
  return MEDIDAS[corpo] ?? MEDIDAS[1];
}

/** Material que ignora luz — usado no que deve "brilhar" (neon, aura, olhos). */
const emissivos = new Map<string, MeshLambertMaterial>();

export function materialBrilhante(cor: string): MeshLambertMaterial {
  let m = emissivos.get(cor);
  if (!m) {
    m = new MeshLambertMaterial({ color: cor, emissive: cor, emissiveIntensity: 0.7 });
    emissivos.set(cor, m);
  }
  return m;
}
