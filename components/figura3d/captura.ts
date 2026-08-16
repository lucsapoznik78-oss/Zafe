// Fotografa o canvas 3D nos dois enquadramentos que o app usa.
//
// O personagem só existe de verdade quando aparece fora desta página — navbar,
// ranking, comentários, perfil público. Rodar WebGL em todos esses lugares é
// impensável (o navegador corta em ~16 contextos vivos e a navbar aparece em
// toda rota), então o navegador tira uma foto na hora de salvar e o resto do
// app serve PNG.
//
// Dois enquadramentos porque um só não serve: 128×128 do rosto some se
// espremido num avatar redondo de 32px, e o corpo inteiro num quadrado vira um
// boneco de 6 pixels de altura.
//
// O truque de tamanho: `setSize(w, h, false)` troca só o buffer de desenho, não
// o CSS. Dá para renderizar em 512×768 dentro de um canvas de 400×500 e devolver
// o tamanho de antes, sem o usuário ver nada piscar.

import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { Vector3 } from "three";

export type Enquadramento = {
  largura: number;
  altura: number;
  /** Ponto para onde a câmera olha. */
  alvo: [number, number, number];
  /** Distância da câmera até o alvo. */
  distancia: number;
  /** Quanto a câmera sobe em relação ao alvo. */
  elevacao: number;
};

/** Rosto para avatar. O alvo é a cabeça, não o centro do corpo. */
export const RETRATO: Enquadramento = {
  largura: 256,
  altura: 256,
  alvo: [0, 2.3, 0],
  distancia: 2.0,
  elevacao: 0.12,
};

/** Corpo inteiro, retrato 2:3. Folga para caber coroa, asas e veículo. */
export const CORPO: Enquadramento = {
  largura: 512,
  altura: 768,
  alvo: [0, 1.45, 0],
  distancia: 6.4,
  elevacao: 0.9,
};

/**
 * Um PNG totalmente transparente é um arquivo VÁLIDO — a assinatura está lá, o
 * decodificador aceita. É exatamente o que `toBlob` devolve quando o Safari
 * derrubou o contexto WebGL sob pressão de memória, e sem este piso o avatar de
 * alguém vira um quadrado vazio que ninguém consegue debugar de fora.
 */
const PISO_BYTES = 1024;

export class CapturaFalhou extends Error {}

async function tirar(
  gl: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  e: Enquadramento,
): Promise<Blob> {
  const larguraAntes = gl.domElement.width;
  const alturaAntes = gl.domElement.height;
  const pixelRatioAntes = gl.getPixelRatio();
  const posAntes = camera.position.clone();
  const quatAntes = camera.quaternion.clone();
  const aspectAntes = camera.aspect;

  try {
    gl.setPixelRatio(1);
    gl.setSize(e.largura, e.altura, false);

    const alvo = new Vector3(...e.alvo);
    camera.aspect = e.largura / e.altura;
    camera.position.set(0, alvo.y + e.elevacao, e.distancia);
    camera.lookAt(alvo);
    camera.updateProjectionMatrix();

    gl.render(scene, camera);

    if (gl.getContext().isContextLost()) {
      throw new CapturaFalhou("contexto WebGL perdido durante a captura");
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      gl.domElement.toBlob(resolve, "image/png"),
    );
    if (!blob || blob.size < PISO_BYTES) {
      throw new CapturaFalhou("a imagem saiu vazia");
    }
    return blob;
  } finally {
    // `finally` e não depois do return: se a captura estourar no meio, o canvas
    // não pode ficar com o buffer do tamanho errado e a câmera no lugar errado.
    gl.setPixelRatio(pixelRatioAntes);
    gl.setSize(larguraAntes, alturaAntes, false);
    camera.aspect = aspectAntes;
    camera.position.copy(posAntes);
    camera.quaternion.copy(quatAntes);
    camera.updateProjectionMatrix();
    gl.render(scene, camera);
  }
}

export async function capturarOsDois(
  gl: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
): Promise<{ retrato: Blob; corpo: Blob }> {
  // Em série, não em paralelo: as duas mexem no MESMO renderer e na MESMA
  // câmera. Em paralelo a segunda mudaria o enquadramento no meio da primeira.
  const retrato = await tirar(gl, scene, camera, RETRATO);
  const corpo = await tirar(gl, scene, camera, CORPO);
  return { retrato, corpo };
}

/** Sonda barata: o editor inteiro depende disto antes de montar um canvas. */
export function temWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
