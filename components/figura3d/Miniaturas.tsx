// A folha de miniaturas da loja: uma imagem só, com os 57 itens desenhados em 3D.
//
// POR QUE UMA FOLHA, E NÃO UM CANVAS POR CARD
//
// O card precisava mostrar o item de verdade — ícone genérico do lucide não diz
// se o "bucket camuflado" é um chapéu ou uma lata. O caminho óbvio (um
// `<Canvas>` por card) é impossível: o navegador corta em ~16 contextos WebGL
// simultâneos e aqui são 57 cards. O 17º cai e derruba os anteriores junto.
//
// Então: UM canvas escondido desenha os 57 itens de uma vez, lado a lado numa
// grade, e vira PNG (`toDataURL`). O card não é 3D — é um `background-position`
// nessa imagem (`lib/figura/miniaturas.ts`). Depois da foto o canvas some, o
// contexto é liberado, e a loja inteira custa uma textura.
//
// A câmera é perspectiva mas MUITO longe, com fov minúsculo: geometricamente é
// uma ortográfica, e evita brigar com o R3F, que reescreve left/right/top/bottom
// de câmera ortográfica a cada resize.

"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Box3, Vector3, type Group } from "three";

import { ITENS } from "@/lib/figura/catalogo";
import { COLUNAS, LINHAS } from "@/lib/figura/miniaturas";
import type { Slot } from "@/lib/figura/tipos";

import { FORMAS } from "./itens";
import { Luzes } from "./luzes";
import { MEDIDAS } from "./primitivas";

const M = MEDIDAS[1];

/**
 * De que ângulo olhar cada família de item.
 *
 * É a única coisa que não dá para descobrir sozinho: o tamanho e o centro saem
 * da caixa envolvente (ver `enquadrar`), mas "de que lado isto se parece com o
 * que é" é julgamento. Uma jaqueta de frente é um retângulo colorido; a três
 * quartos, é uma jaqueta. E capa e mochila ficam ATRÁS do boneco — de frente,
 * a miniatura seria a borda de um pano.
 */
const GIRO: Record<Slot, number> = {
  chapeu: -0.5,
  rosto: -0.35,
  torso: -0.6,
  pernas: -0.5,
  pes: -0.7,
  maoDir: -0.5,
  maoEsq: 0.5,
  costas: 2.5,
  aura: 0,
  veiculo: -0.7,
};

const DIST = 200;
/** fov vertical que faz `LINHAS` células caberem exatamente na altura. */
const FOV = (2 * Math.atan(LINHAS / 2 / DIST) * 180) / Math.PI;
/** Quanto da célula o item ocupa. O resto é respiro. */
const OCUPACAO = 0.82;

/**
 * Centraliza e escala cada item para preencher a própria célula.
 *
 * Feito por caixa envolvente, e não por uma tabela de "altura por slot", porque
 * o mesmo slot mistura uma bola de 36cm com uma espada de 1,5m: um
 * enquadramento fixo mostraria a espada cortada OU a bola do tamanho de um
 * ponto. Medir cada item resolve os 57 de uma vez e continua valendo para o
 * item 58.
 *
 * A caixa é medida DEPOIS da rotação (o grupo interno já está girado) e antes
 * de qualquer escala, então o número que sai é o tamanho aparente na tela.
 */
function enquadrar(grade: Group) {
  const caixa = new Box3();
  const centro = new Vector3();
  const tamanho = new Vector3();

  for (const celula of grade.children) {
    const dentro = celula.children[0];
    if (!dentro) continue;

    dentro.position.set(0, 0, 0);
    celula.scale.setScalar(1);
    celula.updateMatrixWorld(true);

    caixa.setFromObject(dentro);
    if (caixa.isEmpty()) continue;
    caixa.getCenter(centro);
    caixa.getSize(tamanho);

    const maior = Math.max(tamanho.x, tamanho.y);
    if (maior <= 0) continue;

    // `centro` sai em mundo; a célula já está posicionada, então o offset
    // dentro dela é a diferença.
    dentro.position.copy(centro).sub(celula.position).negate();
    celula.scale.setScalar(OCUPACAO / maior);
    celula.updateMatrixWorld(true);
  }
}

function Grade({ aoGerar }: { aoGerar: (url: string) => void }) {
  const grade = useRef<Group>(null);
  const { gl, scene, camera } = useThree();

  // Dois `requestAnimationFrame`: o primeiro deixa o R3F terminar de montar a
  // árvore, o segundo garante que o `Instances` da aura já preencheu as
  // matrizes (ele faz isso num `useFrame`, não na montagem) — medir antes daria
  // caixa vazia. Só então mede, desenha e lê. O `gl.render` na mão é necessário
  // porque em `frameloop="demand"` ninguém garante um quadro neste instante, e
  // buffer não desenhado devolve PNG transparente.
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        if (grade.current) enquadrar(grade.current);
        gl.render(scene, camera);
        aoGerar(gl.domElement.toDataURL("image/png"));
      });
    });
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera, aoGerar]);

  return (
    <group ref={grade}>
      {ITENS.map((it, i) => {
        const Forma = FORMAS[it.forma];
        if (!Forma) return null;
        return (
          <group
            key={it.id}
            position={[(i % COLUNAS) - (COLUNAS - 1) / 2, (LINHAS - 1) / 2 - Math.floor(i / COLUNAS), 0]}
          >
            <group rotation={[0, GIRO[it.slot], 0]}>
              <Forma c={it.cores} m={M} />
            </group>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Canvas descartável. Monta fora da tela, entrega o PNG e o pai o desmonta —
 * mantê-lo vivo seria um segundo contexto WebGL parado ao lado do editor.
 */
export function AtlasMiniaturas({ aoGerar }: { aoGerar: (url: string) => void }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 opacity-0"
      style={{ left: -9999, width: COLUNAS * 64, height: LINHAS * 64 }}
    >
      <Canvas
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        frameloop="demand"
        dpr={2}
        camera={{ fov: FOV, position: [0, 0, DIST], near: DIST - 20, far: DIST + 20 }}
      >
        <Luzes ambiente="plano" />
        <Grade aoGerar={aoGerar} />
      </Canvas>
    </div>
  );
}
