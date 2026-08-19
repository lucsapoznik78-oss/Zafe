// A folha de miniaturas do cast: os 30 personagens prontos numa imagem só.
//
// Mesmo truque de `components/figura3d/Miniaturas.tsx` — o navegador corta em
// ~16 contextos WebGL, então um canvas por card é impossível e um canvas
// escondido desenha todo mundo de uma vez e vira PNG. Duas diferenças que valem
// a explicação:
//
// 1. CÉLULA RETRATO. O acessório cabe num quadrado; o personagem tem 2,86
//    unidades de altura por meia de largura. Célula quadrada deixaria dois
//    terços da imagem vazios e o boneco pequeno demais para se reconhecer.
//
// 2. ESCALA FIXA, NÃO POR CAIXA ENVOLVENTE. Na loja de acessórios cada item é
//    medido e ampliado até preencher a célula, porque uma bola e uma espada não
//    têm tamanho comparável. Aqui é o contrário: os trinta têm exatamente a
//    mesma altura, e enquadrar cada um pela própria caixa faria o de braço
//    erguido encolher para caber — o cast apareceria em tamanhos diferentes
//    sem nenhum motivo visível. Uma escala só para todos mantém a fileira
//    alinhada, que é o que faz trinta bonecos lerem como um elenco.
//
// Esta folha só é desenhada quando alguém abre a aba Avatares. Trinta corpos
// completos custam bem mais que 57 acessórios, e quem entrou para trocar de
// boné não deve pagar por isso.

"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { ACESFilmicToneMapping } from "three";

import { AVATARES } from "@/lib/figura/avatares";
import { COLUNAS_AVATAR, LINHAS_AVATAR } from "@/lib/figura/miniaturas";

import { Luzes } from "../luzes";
import { Avatar3D } from "./Avatar3D";
import { R } from "./rig";

/** Largura da célula em unidades de mundo; a altura é 1. */
const ASPECTO = 0.75;

const DIST = 200;
/** fov vertical que faz `LINHAS_AVATAR` células caberem exatamente na altura. */
const FOV = (2 * Math.atan(LINHAS_AVATAR / 2 / DIST) * 180) / Math.PI;

/**
 * Fração da altura da célula que o boneco ocupa. Não é 1: pose de braço erguido
 * e prop comprido (o cetro do Rei) passam do alto da cabeça, e a margem é o que
 * impede o corte.
 */
const OCUPACAO = 0.82;
const ESCALA = OCUPACAO / R.altura;

/** Três quartos: de frente o personagem é um retângulo, de lado é uma tira. */
const GIRO = -0.45;

/**
 * Tira a foto.
 *
 * Vive DENTRO do `<Suspense>` de propósito, e é o irmão mais novo dos trinta
 * personagens. Um limite suspenso não confirma os filhos, e efeito de filho não
 * confirmado não roda — então este componente só monta quando todos os `.glb`
 * do cast já chegaram. Se a captura morasse fora, ela dispararia enquanto os
 * modelos ainda baixam e gravaria uma folha vazia, que o app guardaria em cache
 * como se fosse o elenco.
 *
 * Dois `requestAnimationFrame` pelo mesmo motivo da folha de acessórios: o
 * primeiro deixa o R3F montar a árvore, o segundo dá o quadro em que a aura
 * (`InstancedMesh`) já preencheu as matrizes. `gl.render` na mão porque em
 * `frameloop="demand"` ninguém garante um quadro agora, e buffer não desenhado
 * devolve PNG transparente.
 */
function Captura({ aoGerar }: { aoGerar: (url: string) => void }) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        gl.render(scene, camera);
        aoGerar(gl.domElement.toDataURL("image/png"));
      });
    });
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera, aoGerar]);

  return null;
}

function Grade({ aoGerar }: { aoGerar: (url: string) => void }) {
  return (
    <Suspense fallback={null}>
      {AVATARES.map((av, i) => (
        <group
          key={av.id}
          position={[
            ((i % COLUNAS_AVATAR) - (COLUNAS_AVATAR - 1) / 2) * ASPECTO,
            (LINHAS_AVATAR - 1) / 2 - Math.floor(i / COLUNAS_AVATAR),
            0,
          ]}
        >
          {/* O boneco nasce com os pés em y=0; descer meia altura põe o meio do
              corpo no meio da célula. */}
          <group scale={ESCALA} position={[0, (-R.altura * ESCALA) / 2, 0]} rotation={[0, GIRO, 0]}>
            <Avatar3D av={av} />
          </group>
        </group>
      ))}
      <Captura aoGerar={aoGerar} />
    </Suspense>
  );
}

/** Canvas descartável: monta fora da tela, entrega o PNG e o pai o desmonta. */
export function AtlasAvatares({ aoGerar }: { aoGerar: (url: string) => void }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 opacity-0"
      style={{ left: -9999, width: COLUNAS_AVATAR * 96, height: LINHAS_AVATAR * 128 }}
    >
      <Canvas
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
        frameloop="demand"
        dpr={2}
        camera={{ fov: FOV, position: [0, 0, DIST], near: DIST - 20, far: DIST + 20 }}
      >
        {/* As MESMAS luzes do editor: a miniatura é a propaganda do que o
            editor entrega, e iluminação diferente venderia outro produto. */}
        <Luzes />
        <Grade aoGerar={aoGerar} />
      </Canvas>
    </div>
  );
}
