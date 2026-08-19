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
// A saída barata seria combinar "exporte sempre em tal altura". Não sobrevive:
// são trinta arquivos feitos aos poucos, e o primeiro que sair fora do combinado
// aparece como um personagem gigante ou minúsculo sem nenhum erro no console.
// Medir a malha e normalizar transforma isso em não-problema — qualquer export
// serve, e trocar um arquivo por uma versão nova nunca mexe numa câmera.

"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import { R } from "./rig";

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

  // Medido uma vez por modelo, antes de qualquer escala nossa. `min.y` costuma
  // ser 0, mas não em todo export (personagem afundado no chão ou pairando é
  // erro comum de origem no Blender); apoiar pelo mínimo da caixa corrige os
  // dois casos sem precisar abrir o arquivo.
  const { escala, base } = useMemo(() => {
    const caixa = new Box3().setFromObject(objeto);
    const altura = caixa.getSize(new Vector3()).y;
    const escala = altura > 0 ? R.altura / altura : 1;
    return { escala, base: -caixa.min.y * escala };
  }, [objeto]);

  return <primitive object={objeto} scale={escala} position={[0, base, 0]} />;
}
