// Props de mão, itens de costas e aura.
//
// O PROP É FILHO DA MÃO, NÃO DO MUNDO (doc §3, "Props soltos no ar").
//
// Tudo neste arquivo é desenhado em coordenada local do PUNHO: origem no pulso,
// mão pendurada para −Y, +Z para a frente do personagem. Como o prop entra como
// filho do mesmo grupo que a mão, ele acompanha ombro e cotovelo sem uma linha
// de conta — e é impossível ele ficar flutuando ao lado do corpo, que é o erro
// que a v1 cometia.
//
// Objeto comprido (cetro, taco, fita) tem o eixo longo em Y e é agarrado no
// meio; objeto pequeno (celular, cronômetro) fica na palma, em −Y.
//
// A AURA É UMA MALHA SÓ. Quarenta partículas soltas seriam quarenta draw calls
// no personagem mais caro do cast, justamente o Lendário. `InstancedMesh` faz
// as quarenta virarem uma, e como o boneco não anima (`frameloop="demand"`) as
// matrizes são calculadas uma vez e nunca mais.

"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Object3D } from "three";
import type { InstancedMesh } from "three";

import type { Costas, Prop } from "@/lib/figura/avatares";

import { Anel, Bloco, BlocoMacio, Capsula, Cilindro, Cone, Disco, Esfera } from "../blocos";
import { DISCO, ESFERA, materialBrilhante, materialTransparente } from "../primitivas";
import { R, luz, sombra } from "./rig";

function cor(lista: string[] | undefined, i: number, alt: string): string {
  return lista?.[i] ?? alt;
}

// ---------------------------------------------------------------------------
// PROPS DE MÃO
// ---------------------------------------------------------------------------

export function PropAvatar({ prop, lado }: { prop: Prop; lado: -1 | 1 }) {
  const c0 = cor(prop.cores, 0, "#F2F4F7");
  const c1 = cor(prop.cores, 1, sombra(c0));
  const c2 = cor(prop.cores, 2, luz(c0, 0.3));
  // Objeto grande sai para FORA do corpo, nunca para dentro — senão atravessa
  // o torso na primeira pose de braço colado.
  const fora = lado * 0.12;

  switch (prop.tipo) {
    case "bola":
      return (
        <group position={[fora, -0.2, 0.04]}>
          <Esfera p={[0, 0, 0]} t={[0.3, 0.3, 0.3]} c={c0} />
          {/* Os gomos: sem eles a bola é uma bola de isopor. */}
          <Disco p={[0, 0, 0.151]} t={[0.11, 0.11, 1]} c={c1} />
          <Disco p={[0, 0, -0.151]} t={[0.11, 0.11, 1]} c={c1} r={[0, Math.PI, 0]} />
          <Disco p={[0.151, 0, 0]} t={[0.11, 0.11, 1]} c={c1} r={[0, Math.PI / 2, 0]} />
          <Disco p={[-0.151, 0, 0]} t={[0.11, 0.11, 1]} c={c1} r={[0, -Math.PI / 2, 0]} />
          <Disco p={[0, 0.151, 0]} t={[0.11, 0.11, 1]} c={c1} r={[-Math.PI / 2, 0, 0]} />
        </group>
      );

    case "cachecol":
      return (
        <group position={[0, -0.1, 0.06]}>
          <Bloco p={[lado * 0.34, 0.02, 0]} t={[0.9, 0.13, 0.05]} c={c0} r={[0, 0, lado * -0.18]} />
          {[-0.3, -0.1, 0.1, 0.3].map((x) => (
            <Bloco key={x} p={[lado * 0.34 + x, 0.02 + x * lado * 0.18, 0.028]} t={[0.09, 0.13, 0.02]} c={c1} />
          ))}
          <Bloco p={[lado * 0.78, -0.06, 0]} t={[0.13, 0.1, 0.05]} c={c1} />
        </group>
      );

    case "prancheta":
      return (
        <group position={[fora * 0.6, -0.16, 0.08]} rotation={[0.3, lado * 0.2, lado * 0.12]}>
          <Bloco p={[0, 0, 0]} t={[0.32, 0.42, 0.02]} c={c1} />
          <Bloco p={[0, -0.02, 0.016]} t={[0.28, 0.34, 0.01]} c={c0} />
          <Bloco p={[0, 0.19, 0.022]} t={[0.13, 0.05, 0.03]} c={sombra(c1, 0.6)} />
          {[0.08, 0.02, -0.04, -0.1].map((y) => (
            <Bloco key={y} p={[0, y, 0.023]} t={[0.2, 0.014, 0.008]} c="#8A8F98" />
          ))}
        </group>
      );

    case "radio":
      return (
        <group position={[0, -0.14, 0.05]} rotation={[0, 0, lado * 0.2]}>
          <BlocoMacio p={[0, 0, 0]} t={[0.19, 0.28, 0.09]} c={c0} />
          <Bloco p={[0, 0.05, 0.05]} t={[0.13, 0.13, 0.02]} c={c1} />
          {[-0.03, 0, 0.03].map((y) => (
            <Bloco key={y} p={[0, 0.05 + y, 0.062]} t={[0.12, 0.012, 0.01]} c={sombra(c1, 0.6)} />
          ))}
          <Bloco p={[0, -0.08, 0.05]} t={[0.11, 0.04, 0.02]} c="#7CC0A0" brilha />
          <Capsula p={[0.07, 0.24, 0]} t={[0.018, 0.2, 0.018]} c={c1} r={[0, 0, -0.14]} />
        </group>
      );

    case "pipoca":
      return (
        <group position={[fora * 0.5, -0.2, 0.05]}>
          <Cone p={[0, 0, 0]} t={[0.26, 0.32, 0.26]} c={c0} r={[Math.PI, 0, 0]} />
          {[-0.08, 0, 0.08].map((x) => (
            <Bloco key={x} p={[x, 0, 0.13]} t={[0.04, 0.32, 0.01]} c={c1} />
          ))}
          {[
            [-0.07, 0.18, 0.02],
            [0.05, 0.21, -0.03],
            [0, 0.17, 0.07],
            [0.09, 0.16, 0.04],
            [-0.04, 0.23, -0.05],
          ].map(([x, y, z]) => (
            <Esfera key={`${x}-${y}`} p={[x, y, z]} t={[0.09, 0.08, 0.09]} c={c2} />
          ))}
        </group>
      );

    case "skate":
      return (
        <group position={[fora, -0.34, 0]} rotation={[0, 0, lado * 0.12]}>
          <BlocoMacio p={[0, 0, 0]} t={[0.2, 0.86, 0.05]} c={c0} />
          <Bloco p={[0, 0.4, 0]} t={[0.19, 0.1, 0.055]} c={c1} r={[0.3, 0, 0]} />
          <Bloco p={[0, -0.4, 0]} t={[0.19, 0.1, 0.055]} c={c1} r={[-0.3, 0, 0]} />
          {[0.26, -0.26].map((y) => (
            <Bloco key={y} p={[0, y, -0.05]} t={[0.13, 0.05, 0.05]} c="#8A8F98" />
          ))}
          {[
            [0.1, 0.26],
            [-0.1, 0.26],
            [0.1, -0.26],
            [-0.1, -0.26],
          ].map(([x, y]) => (
            <Cilindro key={`${x}-${y}`} p={[x, y, -0.085]} t={[0.09, 0.05, 0.09]} c={c2} r={[0, 0, Math.PI / 2]} />
          ))}
        </group>
      );

    case "celular":
      return (
        <group position={[0, -0.13, 0.07]} rotation={[0.35, lado * 0.3, 0]}>
          <BlocoMacio p={[0, 0, 0]} t={[0.14, 0.26, 0.022]} c={c1} />
          <Bloco p={[0, 0.005, 0.014]} t={[0.12, 0.22, 0.008]} c={c0} brilha />
          <Bloco p={[0, -0.11, 0.016]} t={[0.05, 0.012, 0.006]} c={sombra(c1, 0.5)} />
        </group>
      );

    case "raquete":
      return (
        <group position={[fora * 0.5, -0.3, 0.02]} rotation={[0, 0, lado * 0.3]}>
          <Cilindro p={[0, 0.12, 0]} t={[0.035, 0.34, 0.035]} c={c1} />
          <Bloco p={[0, -0.02, 0]} t={[0.05, 0.1, 0.05]} c={sombra(c1, 0.7)} />
          <Anel p={[0, 0.48, 0]} t={[0.42, 0.56, 0.06]} c={c0} />
          {[-0.1, 0, 0.1].map((x) => (
            <Bloco key={x} p={[x, 0.48, 0]} t={[0.008, 0.5, 0.008]} c="#D9DCE2" />
          ))}
          {[-0.12, 0, 0.12].map((y) => (
            <Bloco key={y} p={[0, 0.48 + y, 0]} t={[0.36, 0.008, 0.008]} c="#D9DCE2" />
          ))}
        </group>
      );

    case "prancha":
      return (
        <group position={[fora * 1.6, -0.24, -0.12]} rotation={[0.12, 0, lado * 0.16]}>
          <Capsula p={[0, 0, 0]} t={[0.36, 1.5, 0.12]} c={c0} />
          <Bloco p={[0, 0, 0.062]} t={[0.06, 1.5, 0.02]} c={c1} />
          <Bloco p={[0, 0.5, 0.062]} t={[0.3, 0.16, 0.02]} c={c2} r={[0, 0, 0.3]} />
          <Cone p={[0, -0.86, -0.1]} t={[0.1, 0.24, 0.16]} c={c1} r={[0.4, 0, 0]} />
        </group>
      );

    case "luvaBoxe":
      return (
        <group position={[0, -0.08, 0.02]}>
          <BlocoMacio p={[0, -0.06, 0.02]} t={[0.26, 0.28, 0.3]} c={c0} />
          <Esfera p={[0, -0.02, 0.14]} t={[0.24, 0.22, 0.16]} c={luz(c0, 0.1)} />
          <Cilindro p={[0, 0.09, 0]} t={[0.21, 0.11, 0.21]} c={c1} />
          <Bloco p={[0, 0.09, 0.1]} t={[0.11, 0.09, 0.03]} c={c2} />
          <Bloco p={[lado * 0.12, -0.06, 0.05]} t={[0.06, 0.13, 0.14]} c={sombra(c0, 0.85)} />
        </group>
      );

    case "tacoSinuca":
      return (
        <group position={[fora * 0.4, -0.2, 0.02]} rotation={[0.5, 0, lado * 0.5]}>
          <Cilindro p={[0, 0.55, 0]} t={[0.03, 1.1, 0.03]} c={c0} />
          <Cilindro p={[0, -0.35, 0]} t={[0.042, 0.7, 0.042]} c={c1} />
          <Cilindro p={[0, 1.11, 0]} t={[0.026, 0.03, 0.026]} c="#3C6E8F" />
          <Cilindro p={[0, 0.02, 0]} t={[0.046, 0.05, 0.046]} c={c2} />
        </group>
      );

    case "halter":
      return (
        <group position={[0, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <Cilindro p={[0, 0, 0]} t={[0.05, 0.34, 0.05]} c={c1} />
          {[-0.19, 0.19].map((y) => (
            <Cilindro key={y} p={[0, y, 0]} t={[0.24, 0.12, 0.24]} c={c0} />
          ))}
          {[-0.27, 0.27].map((y) => (
            <Cilindro key={y} p={[0, y, 0]} t={[0.19, 0.07, 0.19]} c={sombra(c0, 0.8)} />
          ))}
        </group>
      );

    case "microfone":
      return (
        <group position={[0, -0.14, 0.04]} rotation={[-0.5, 0, lado * 0.2]}>
          <Cilindro p={[0, -0.02, 0]} t={[0.05, 0.26, 0.05]} c={c1} />
          <Esfera p={[0, 0.16, 0]} t={[0.14, 0.14, 0.14]} c={c0} />
          <Anel p={[0, 0.1, 0]} t={[0.13, 0.13, 0.2]} c={c2} r={[Math.PI / 2, 0, 0]} />
          <Cilindro p={[0, -0.17, 0]} t={[0.035, 0.06, 0.035]} c={sombra(c1, 0.6)} />
        </group>
      );

    case "cartaoVermelho":
      return (
        <group position={[0, -0.1, 0.05]} rotation={[0, lado * 0.24, lado * 0.06]}>
          <Bloco p={[0, 0.02, 0]} t={[0.22, 0.32, 0.014]} c={c0} />
          <Bloco p={[0, 0.02, 0.01]} t={[0.19, 0.28, 0.006]} c={luz(c0, 0.18)} />
        </group>
      );

    case "luneta":
      return (
        <group position={[0, -0.1, 0.06]} rotation={[-0.7, lado * 0.3, 0]}>
          <Cilindro p={[0, 0.1, 0]} t={[0.09, 0.28, 0.09]} c={c0} r={[Math.PI / 2, 0, 0]} />
          <Cilindro p={[0, 0.1, 0.22]} t={[0.07, 0.2, 0.07]} c={c1} r={[Math.PI / 2, 0, 0]} />
          <Cilindro p={[0, 0.1, -0.18]} t={[0.11, 0.08, 0.11]} c={c1} r={[Math.PI / 2, 0, 0]} />
          <Disco p={[0, 0.1, 0.33]} t={[0.06, 0.06, 1]} c={c2} brilha />
          <Anel p={[0, 0.1, 0]} t={[0.1, 0.1, 0.3]} c={c2} r={[Math.PI / 2, 0, 0]} />
        </group>
      );

    case "fita":
      return (
        <group position={[0, -0.12, 0.04]}>
          <Cilindro p={[0, 0, 0]} t={[0.026, 0.3, 0.026]} c={c1} r={[0.6, 0, lado * 0.4]} />
          {/* A fita é uma sequência de segmentos alternando o giro. É o mínimo
              para ler como pano em movimento em vez de mangueira. */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Bloco
              key={i}
              p={[lado * (0.16 + i * 0.2), 0.14 + Math.sin(i * 1.3) * 0.24, -0.02 + Math.cos(i * 1.1) * 0.1]}
              t={[0.24, 0.035, 0.012]}
              c={c0}
              r={[0, 0, Math.sin(i * 1.3 + 1) * 0.9]}
            />
          ))}
        </group>
      );

    case "shuriken":
      return (
        <group position={[0, -0.1, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <Bloco p={[0, 0, 0]} t={[0.1, 0.02, 0.1]} c={c1} />
          {[0, 1, 2, 3].map((i) => (
            <Cone
              key={i}
              p={[Math.sin((i / 4) * Math.PI * 2) * 0.12, 0, Math.cos((i / 4) * Math.PI * 2) * 0.12]}
              t={[0.09, 0.018, 0.2]}
              c={c0}
              r={[Math.PI / 2, (i / 4) * Math.PI * 2, 0]}
            />
          ))}
          <Cilindro p={[0, 0.012, 0]} t={[0.04, 0.02, 0.04]} c={c2} />
        </group>
      );

    case "pocao":
      return (
        <group position={[0, -0.14, 0.04]}>
          <Esfera p={[0, -0.02, 0]} t={[0.2, 0.2, 0.2]} c={c0} opacidade={0.5} />
          <Esfera p={[0, -0.05, 0]} t={[0.15, 0.12, 0.15]} c={c2} brilha />
          <Cilindro p={[0, 0.11, 0]} t={[0.07, 0.11, 0.07]} c={c0} opacidade={0.5} />
          <Cilindro p={[0, 0.18, 0]} t={[0.085, 0.05, 0.085]} c={c1} />
          <Esfera p={[0.05, 0.04, 0.05]} t={[0.04, 0.04, 0.04]} c={luz(c2, 0.5)} brilha />
        </group>
      );

    case "cetro":
      return (
        <group position={[fora * 0.9, -0.34, 0.03]}>
          <Cilindro p={[0, 0, 0]} t={[0.045, 1.9, 0.045]} c={c1} />
          <Cilindro p={[0, 0.34, 0]} t={[0.055, 0.07, 0.055]} c={c0} />
          <Cilindro p={[0, -0.34, 0]} t={[0.055, 0.07, 0.055]} c={c0} />
          <Cilindro p={[0, -0.94, 0]} t={[0.07, 0.06, 0.07]} c={c0} />
          <Anel p={[0, 0.9, 0]} t={[0.2, 0.2, 0.24]} c={c0} />
          <Esfera p={[0, 0.98, 0]} t={[0.18, 0.18, 0.18]} c={c2} brilha />
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2;
            return (
              <Cone
                key={i}
                p={[Math.sin(a) * 0.11, 1.1, Math.cos(a) * 0.11]}
                t={[0.06, 0.12, 0.06]}
                c={c0}
              />
            );
          })}
        </group>
      );

    case "luvaGoleiro":
      return (
        <group position={[0, -0.07, 0.03]}>
          <BlocoMacio p={[0, -0.1, 0.03]} t={[0.24, 0.32, 0.16]} c={c0} />
          <Bloco p={[0, -0.1, 0.11]} t={[0.21, 0.28, 0.03]} c={c1} />
          {[-0.06, 0, 0.06].map((x) => (
            <Bloco key={x} p={[x, -0.15, 0.125]} t={[0.04, 0.18, 0.012]} c={c2} />
          ))}
          <Cilindro p={[0, 0.07, 0]} t={[0.2, 0.09, 0.16]} c={c1} />
          <Bloco p={[0, 0.07, 0.09]} t={[0.09, 0.06, 0.02]} c={c2} />
        </group>
      );

    case "cronometro":
      return (
        <group position={[0, -0.11, 0.05]} rotation={[0.4, 0, 0]}>
          <Cilindro p={[0, 0, 0]} t={[0.2, 0.05, 0.2]} c={c0} r={[Math.PI / 2, 0, 0]} />
          <Disco p={[0, 0, 0.027]} t={[0.16, 0.16, 1]} c="#F7F8FA" />
          <Bloco p={[0, 0.03, 0.032]} t={[0.012, 0.09, 0.006]} c="#C0392B" r={[0, 0, 0.4]} />
          <Cilindro p={[0, 0.12, 0]} t={[0.05, 0.05, 0.05]} c={c1} />
          <Capsula p={[0, 0.26, -0.02]} t={[0.016, 0.22, 0.016]} c={c1} r={[0.3, 0, 0]} />
        </group>
      );

    case "garrafa":
    default:
      return (
        <group position={[0, -0.16, 0.03]}>
          <Cilindro p={[0, 0, 0]} t={[0.13, 0.34, 0.13]} c={c0} opacidade={0.62} />
          <Cilindro p={[0, -0.06, 0]} t={[0.115, 0.2, 0.115]} c={c2} />
          <Cilindro p={[0, 0.2, 0]} t={[0.07, 0.08, 0.07]} c={c1} />
          <Cilindro p={[0, 0.26, 0]} t={[0.08, 0.05, 0.08]} c={sombra(c1, 0.8)} />
          <Bloco p={[0, 0.02, 0.068]} t={[0.06, 0.14, 0.01]} c={luz(c0, 0.4)} opacidade={0.5} />
        </group>
      );
  }
}

// ---------------------------------------------------------------------------
// COSTAS
//
// Coordenada local do TRONCO: y=0 no quadril, z negativo é atrás.
// ---------------------------------------------------------------------------

export function CostasAvatar({ costas }: { costas: Costas }) {
  const c0 = cor(costas.cores, 0, "#2B5CA8");
  const c1 = cor(costas.cores, 1, sombra(c0));
  const c2 = cor(costas.cores, 2, luz(c0, 0.3));
  const zc = -R.torsoP / 2;

  switch (costas.tipo) {
    case "cauda":
      // Três segmentos afinando: é o mínimo para uma cauda curvar em vez de
      // apontar reto para trás como um cabo.
      return (
        <group position={[0, R.torsoA * 0.12, zc]}>
          <Capsula p={[0, -0.02, -0.16]} t={[0.15, 0.22, 0.15]} c={c0} r={[1.2, 0, 0]} />
          <Capsula p={[0.04, 0.1, -0.38]} t={[0.12, 0.2, 0.12]} c={c0} r={[0.7, 0.2, 0]} />
          <Capsula p={[0.1, 0.32, -0.5]} t={[0.09, 0.2, 0.09]} c={c1} r={[0.2, 0.3, 0.2]} />
          <Esfera p={[0.14, 0.46, -0.5]} t={[0.11, 0.11, 0.11]} c={c2} />
          {[
            [0, -0.02, -0.16],
            [0.04, 0.1, -0.38],
          ].map(([x, y, z], i) => (
            <Bloco key={i} p={[x, y, z]} t={[0.16, 0.03, 0.16]} c={c1} r={[0.9 - i * 0.3, 0, 0]} />
          ))}
        </group>
      );

    case "mochilaEspacial":
      return (
        <group position={[0, R.torsoA * 0.52, zc - 0.11]}>
          <BlocoMacio p={[0, 0, 0]} t={[0.5, 0.56, 0.22]} c={c0} />
          <Cilindro p={[-0.14, 0.02, -0.14]} t={[0.14, 0.5, 0.14]} c={c1} />
          <Cilindro p={[0.14, 0.02, -0.14]} t={[0.14, 0.5, 0.14]} c={c1} />
          <Bloco p={[0, 0.16, 0.12]} t={[0.2, 0.09, 0.03]} c={c2} brilha />
          <Bloco p={[0, -0.3, -0.06]} t={[0.34, 0.08, 0.2]} c={sombra(c0, 0.7)} />
          {/* Alças por cima do ombro — sem elas a mochila fica colada por magia. */}
          <Bloco p={[-0.19, 0.3, 0.2]} t={[0.07, 0.12, 0.5]} c={c1} r={[0.3, 0, 0]} />
          <Bloco p={[0.19, 0.3, 0.2]} t={[0.07, 0.12, 0.5]} c={c1} r={[0.3, 0, 0]} />
        </group>
      );

    case "capa":
      return (
        <group position={[0, R.torsoA * 0.5, zc - 0.03]}>
          <Bloco p={[0, -0.24, -0.06]} t={[R.torsoL * 1.16, 1.1, 0.05]} c={c0} r={[0.06, 0, 0]} />
          <Bloco p={[0, -0.78, -0.12]} t={[R.torsoL * 1.3, 0.24, 0.05]} c={c1} r={[0.24, 0, 0]} />
          <Bloco p={[0, 0.28, 0.02]} t={[R.torsoL * 1.0, 0.1, 0.08]} c={c2} />
          <Bloco p={[-R.torsoL * 0.5, -0.2, -0.05]} t={[0.04, 0.95, 0.055]} c={sombra(c0, 0.78)} />
          <Bloco p={[R.torsoL * 0.5, -0.2, -0.05]} t={[0.04, 0.95, 0.055]} c={sombra(c0, 0.78)} />
        </group>
      );

    case "prancha":
      return (
        <group position={[0, R.torsoA * 0.5, zc - 0.14]} rotation={[0, 0, 0.4]}>
          <Capsula p={[0, 0, 0]} t={[0.34, 1.5, 0.11]} c={c0} r={[0, 0, Math.PI / 2]} />
          <Bloco p={[0, 0, -0.06]} t={[1.5, 0.06, 0.02]} c={c1} />
          <Bloco p={[0.3, 0, 0.055]} t={[0.3, 0.2, 0.02]} c={c2} />
        </group>
      );

    case "mochila":
    default:
      return (
        <group position={[0, R.torsoA * 0.45, zc - 0.1]}>
          <BlocoMacio p={[0, 0, 0]} t={[0.46, 0.54, 0.2]} c={c0} />
          <Bloco p={[0, -0.14, 0.06]} t={[0.36, 0.2, 0.14]} c={c1} />
          <Bloco p={[0, 0.02, 0.1]} t={[0.4, 0.03, 0.05]} c={c2} />
          <Bloco p={[0, 0.24, 0.02]} t={[0.14, 0.09, 0.16]} c={c1} />
          <Bloco p={[-0.17, 0.28, 0.2]} t={[0.07, 0.12, 0.46]} c={c1} r={[0.3, 0, 0]} />
          <Bloco p={[0.17, 0.28, 0.2]} t={[0.07, 0.12, 0.46]} c={c1} r={[0.3, 0, 0]} />
        </group>
      );
  }
}

// ---------------------------------------------------------------------------
// AURA
// ---------------------------------------------------------------------------

const N_PARTICULAS = 40;

export function Aura({ cor: c }: { cor: string }) {
  const malha = useRef<InstancedMesh>(null);
  const mat = useMemo(() => materialBrilhante(c), [c]);

  // Distribuição determinística: mesma semente, mesma aura, sempre. Aleatório
  // de verdade faria o Lendário sair diferente em cada captura de PNG.
  const matrizes = useMemo(() => {
    const alvo = new Object3D();
    const saida: number[][] = [];
    for (let i = 0; i < N_PARTICULAS; i++) {
      const t = i / N_PARTICULAS;
      const angulo = t * Math.PI * 2 * 3.7;
      const raio = 0.5 + Math.sin(i * 2.1) * 0.28;
      const escala = 0.03 + ((i * 7) % 5) * 0.012;
      alvo.position.set(Math.sin(angulo) * raio, 0.12 + t * (R.yTopo + 0.24), Math.cos(angulo) * raio);
      alvo.scale.setScalar(escala);
      alvo.updateMatrix();
      saida.push(alvo.matrix.toArray());
    }
    return saida;
  }, []);

  useLayoutEffect(() => {
    const m = malha.current;
    if (!m) return;
    const alvo = new Object3D();
    matrizes.forEach((arr, i) => {
      alvo.matrix.fromArray(arr);
      m.setMatrixAt(i, alvo.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [matrizes]);

  return (
    <>
      <instancedMesh ref={malha} args={[ESFERA, mat, N_PARTICULAS]} frustumCulled={false} />
      {/* Halo no chão: é o que amarra as partículas ao personagem em vez de
          parecerem poeira flutuando por perto. */}
      <mesh
        geometry={DISCO}
        material={materialTransparente(c, 0.16)}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[3.2, 3.2, 1]}
      />
    </>
  );
}
