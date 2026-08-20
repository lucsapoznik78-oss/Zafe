// Carrega um personagem esculpido (`.glb`) e o entrega no mesmo espaço em que o
// rig procedural vive.
//
// O QUE ESTE ARQUIVO RESOLVE
//
// O resto do app foi calibrado em torno de um boneco de altura fixa (`R.altura`)
// com os pés em y=0: a câmera do editor, o alvo do `OrbitControls`, a sombra de
// contato, o enquadramento das duas folhas de miniaturas. Um `.glb` chega na
// escala e na origem que o Blender quis — normalmente 1 unidade = 1 metro, com
// o personagem em torno de 1,8, contra os 2,86 daqui.
//
// Houve aqui uma tentativa de resolver isso medindo cada malha e esticando-a
// até `R.altura`. O argumento era que trinta arquivos feitos aos poucos sempre
// teriam um fora do combinado, e medir tornaria a convenção desnecessária.
//
// O argumento estava errado por um motivo que só aparece em render: a caixa
// envolvente não mede o personagem, mede a POSE. Quem chuta, agacha ou se
// inclina ocupa menos altura, é ampliado para compensar, e sai maior que todo
// mundo — o oposto do pretendido. E a convenção que se queria evitar não é
// frágil: os trinta saem do mesmo script, que agora recusa exportar fora da
// faixa. Escala é constante; só o assentamento no chão continua medido.

"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Color } from "three";
import type { Material } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import { ESCALA_GLB } from "./rig";

/**
 * Onde mora o decodificador do Draco.
 *
 * Os `.glb` do cast saem do `scripts/comprimir-avatares.mjs` com a geometria em
 * `KHR_draco_mesh_compression` — 943 KB viram 94 KB, e são trinta arquivos. O
 * preço é que o navegador precisa do descompressor, ~250 KB de wasm, uma vez
 * para os trinta.
 *
 * O padrão do drei é buscá-lo no CDN do Google (`gstatic.com/draco/...`), e
 * aqui isso não roda: a CSP de `next.config.mjs` declara `connect-src 'self'
 * <supabase>`. O fetch morre bloqueado — em produção, em silêncio, e o
 * personagem simplesmente nunca aparece. Por isso o decodificador é copiado
 * para `public/draco/` e servido do próprio domínio.
 */
const DRACO = "/draco/";

/**
 * O fio de luz no contorno, por fresnel — em cima da luz de contorno que
 * `luzes.tsx` já projeta.
 *
 * A direcional de rim só acende o lado dela: girado 180°, o personagem fica com
 * o contorno apagado justamente onde o usuário parou de girar. O fresnel não
 * tem lado — ele acende onde a superfície vira de perfil para a CÂMERA, então o
 * contorno acompanha o giro e a silhueta se descola do fundo em qualquer
 * ângulo. Custa um `pow` por fragmento e zero byte de download.
 *
 * ONDE ENTRA NO SHADER, E POR QUE NÃO NO FIM
 *
 * O lugar óbvio é depois do último include, e é errado: ali a cor já passou
 * pelo ACES e pelo sRGB, então o acréscimo entra em valor de tela e vira borda
 * queimada, exatamente o defeito que a Fase 1 tirou. Injetando antes do
 * `tonemapping_fragment` o rim é luz linear como qualquer outra e o ACES o
 * comprime junto — que é o que o faz ler como fio, e não como contorno branco.
 */
const RIM = { cor: new Color("#9DC4FF"), expoente: 2.6, forca: 0.55 };

function comRim(material: Material) {
  // A `useGLTF` guarda por URL e o `SkeletonUtils.clone` COMPARTILHA material:
  // sem a trava, todo remonte reatribui `onBeforeCompile` e força recompilar o
  // programa — que é a única coisa cara nesta função.
  if (material.userData.rim) return;
  material.userData.rim = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimCor = { value: RIM.cor };
    shader.uniforms.uRimExp = { value: RIM.expoente };
    shader.uniforms.uRimForca = { value: RIM.forca };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uRimCor;\nuniform float uRimExp;\nuniform float uRimForca;",
      )
      .replace(
        "#include <tonemapping_fragment>",
        // `normal` e `vViewPosition` são do próprio meshphysical: a normal em
        // espaço de vista e o vetor fragmento->câmera. O produto escalar dos
        // dois é 1 de frente e 0 de perfil — daí o `1.0 -`.
        `{
  float fresnel = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
  gl_FragColor.rgb += uRimCor * pow(fresnel, uRimExp) * uRimForca;
}
#include <tonemapping_fragment>`,
      );
  };
  material.needsUpdate = true;
}

export function ModeloAvatar({ url }: { url: string }) {
  const { scene } = useGLTF(url, DRACO);

  // `useGLTF` guarda em cache POR URL e devolve sempre a mesma instância. Montar
  // o mesmo `Object3D` em dois lugares não duplica nada: o three tira do lugar
  // anterior e põe no novo, então o personagem sumiria do editor no instante em
  // que a folha de miniaturas o desenhasse. Clonar é obrigatório.
  //
  // E é `SkeletonUtils.clone`, não `Object3D.clone`: o clone cru copia as malhas
  // mas continua apontando para os MESMOS ossos, então dois clones dividiriam
  // uma pose só — mover um moveria o outro.
  const objeto = useMemo(() => {
    const c = clone(scene);
    // Sombra própria: o braço escurece o tronco, a aba do boné escurece o
    // rosto. É a oclusão que o `ContactShadows` do canvas não dá, porque aquele
    // é um passe visto de baixo que só sabe desenhar a mancha no chão.
    //
    // Só o cast entra nisto. O boneco montável de `primitivas.ts` são ~40
    // malhas Lambert, e cada uma no passe de sombra é geometria redesenhada de
    // graça num celular — o custo lá não paga o ganho.
    c.traverse((o) => {
      const malha = o as {
        isMesh?: boolean;
        castShadow?: boolean;
        receiveShadow?: boolean;
        material?: Material;
      };
      if (!malha.isMesh) return;
      malha.castShadow = true;
      malha.receiveShadow = true;
      if (malha.material) comRim(malha.material);
    });
    return c;
  }, [scene]);

  // A ESCALA é constante (ver `ALTURA_BASE_GLB`): medir cada arquivo mede a
  // altura da pose, não a do personagem, e faz quem se inclina crescer.
  //
  // A POSIÇÃO continua medida, e por outro motivo: `min.y` deveria ser 0, mas
  // sai alguns milímetros fora em quase todo export, e personagem afundado no
  // chão ou pairando é o erro de origem mais comum do Blender. Apoiar pelo
  // mínimo da caixa custa nada e não distorce nada — só translada.
  const base = useMemo(() => {
    const caixa = new Box3().setFromObject(objeto);
    return -caixa.min.y * ESCALA_GLB;
  }, [objeto]);

  return <primitive object={objeto} scale={ESCALA_GLB} position={[0, base, 0]} />;
}
