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
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { ACESFilmicToneMapping } from "three";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";

import type { FiguraV2 } from "@/lib/figura/tipos";

import { Personagem } from "./Personagem";
import { Luzes } from "./luzes";
import { capturarOsDois } from "./captura";

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

/**
 * Sombra de contato de verdade, no lugar do disco escuro que havia aqui.
 *
 * O disco era um círculo de opacidade fixa: mesmo tamanho e mesma intensidade
 * com o boneco de pé, agachado ou em cima de um skate — ou seja, não era
 * sombra, era um decalque. `ContactShadows` renderiza a silhueta real vista de
 * baixo, então a mancha acompanha a pose, escurece onde o pé toca e some
 * debaixo do que está no ar. É o que assenta o personagem no chão em vez de
 * deixá-lo pairando.
 *
 * `blur` alto e `resolution` baixa de propósito: o que se quer é a mancha, não
 * o recorte nítido dos dedos do pé — e é o que mantém o passe barato.
 */
function Chao() {
  return (
    <ContactShadows
      position={[0, 0.002, 0]}
      scale={5.5}
      resolution={512}
      blur={2.6}
      opacity={0.5}
      far={2.2}
      color="#0B0D12"
    />
  );
}

export const PersonagemCanvas = forwardRef<
  Alca,
  { figura: FiguraV2; posicao?: number | null; className?: string }
>(function PersonagemCanvas({ figura, posicao, className }, ref) {
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
      // ACES em vez do tone mapping linear: comprime o alto sem estourar, então
      // o branco da gola e o neon da aura param de virar chapa saturada, e a
      // rim light aparece como fio de luz em vez de borda queimada.
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [0, 2.4, 6.4], fov: 35 }}
    >
      <Publica para={tres} />
      <Luzes />
      <Chao />
      <Personagem figura={figura} posicao={posicao} />
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
});
