// O único canvas WebGL do app.
//
// Decisões que não são estilo:
//
// `preserveDrawingBuffer: true` — sem isso o navegador tem licença para limpar
// o buffer depois de desenhar, e `toBlob` devolve preto. É o que torna a foto
// possível, e custa um pouco de memória.
//
// `frameloop="demand"` — o personagem não anima. Redesenhar 60x por segundo um
// boneco parado esquentaria o celular de quem está escolhendo tênis. O R3F
// redesenha sozinho quando uma prop muda; o `OrbitControls` pede quadro
// enquanto o dedo está na tela.
//
// Sem sombra projetada em lugar nenhum. Shadow map é o maior custo isolado numa
// GPU de celular e num boneco de blocos rende quase nada — o contato com o chão
// é um disco escuro translúcido, que custa uma malha.
//
// O canvas NÃO desmonta na troca de aba (ver a página): remontar recria o
// contexto WebGL, perde a rotação escolhida e paga o init de novo.

"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";

import type { FiguraV2 } from "@/lib/figura/tipos";

import { Personagem } from "./Personagem";
import { capturarOsDois } from "./captura";
import { materialTransparente } from "./primitivas";
import { DISCO } from "./primitivas";

export type Alca = {
  capturar: () => Promise<{ retrato: Blob; corpo: Blob }>;
};

type Tres = { gl: WebGLRenderer; scene: Scene; camera: PerspectiveCamera };

/** Publica gl/scene/camera para fora do Canvas — a captura mora no pai. */
function Publica({ para }: { para: React.MutableRefObject<Tres | null> }) {
  const { gl, scene, camera } = useThree();
  para.current = { gl, scene, camera: camera as PerspectiveCamera };
  return null;
}

function Chao() {
  return (
    <mesh
      geometry={DISCO}
      material={materialTransparente("#000000", 0.22)}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.002, 0]}
      scale={[2.6, 2.6, 1]}
    />
  );
}

export const PersonagemCanvas = forwardRef<Alca, { figura: FiguraV2; className?: string }>(
  function PersonagemCanvas({ figura, className }, ref) {
    const tres = useRef<Tres | null>(null);

    useImperativeHandle(ref, () => ({
      capturar: async () => {
        const t = tres.current;
        if (!t) throw new Error("canvas ainda não montou");
        return capturarOsDois(t.gl, t.scene, t.camera);
      },
    }));

    return (
      <Canvas
        className={className}
        // `alpha` deixa o PNG salvo transparente: o avatar entra em cima de
        // qualquer fundo do app sem carregar um retângulo junto.
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [0, 2.4, 6.4], fov: 35 }}
      >
        <Publica para={tres} />
        <hemisphereLight intensity={0.85} groundColor="#20232A" />
        <directionalLight position={[3, 6, 4]} intensity={1.15} />
        <Chao />
        <Personagem figura={figura} />
        <OrbitControls
          // Trava tudo que não seja girar em torno do eixo vertical: sem isso o
          // usuário arrasta uma vez e fica olhando para a sola do pé, sem saber
          // como voltar.
          enablePan={false}
          minDistance={3.5}
          maxDistance={9}
          minPolarAngle={Math.PI * 0.22}
          maxPolarAngle={Math.PI * 0.52}
          target={[0, 1.45, 0]}
        />
      </Canvas>
    );
  },
);
