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
import { Box3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import { ESCALA_GLB } from "./rig";

export function ModeloAvatar({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  // `useGLTF` guarda em cache POR URL e devolve sempre a mesma instância. Montar
  // o mesmo `Object3D` em dois lugares não duplica nada: o three tira do lugar
  // anterior e põe no novo, então o personagem sumiria do editor no instante em
  // que a folha de miniaturas o desenhasse. Clonar é obrigatório.
  //
  // E é `SkeletonUtils.clone`, não `Object3D.clone`: o clone cru copia as malhas
  // mas continua apontando para os MESMOS ossos, então dois clones dividiriam
  // uma pose só — mover um moveria o outro.
  const objeto = useMemo(() => clone(scene), [scene]);

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
