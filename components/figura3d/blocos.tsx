// Invólucros finos sobre `<mesh>`.
//
// Cada um só amarra uma geometria compartilhada a um material do cache e traduz
// "tamanho" em `scale` — as geometrias são unitárias, então escalar é o jeito
// de ter mil tamanhos sem criar mil buffers. Existir como componente é o que
// mantém os 44 itens legíveis: `<Bloco p={[0,1,0]} t={[1,.2,1]} c="#000" />` em
// vez de seis linhas de `<mesh geometry material position scale />`.

"use client";

import type { ThreeElements } from "@react-three/fiber";
import type { BufferGeometry } from "three";

import {
  CAIXA,
  CAPSULA,
  CILINDRO,
  CONE,
  DISCO,
  ESFERA,
  TORUS,
  material,
  materialBrilhante,
  materialTransparente,
} from "./primitivas";

type Vec = [number, number, number];

type Props = {
  /** Posição do centro. */
  p: Vec;
  /** Tamanho em cada eixo. */
  t: Vec;
  /** Cor (hex). */
  c: string;
  /** Rotação em radianos. */
  r?: Vec;
  /** Ignora a luz — para neon e olhos. */
  brilha?: boolean;
  /** Opacidade < 1 usa o cache de materiais translúcidos. */
  opacidade?: number;
} & Omit<ThreeElements["mesh"], "position" | "scale" | "rotation" | "geometry" | "material">;

function mat(c: string, brilha?: boolean, opacidade?: number) {
  if (opacidade !== undefined && opacidade < 1) return materialTransparente(c, opacidade);
  return brilha ? materialBrilhante(c) : material(c);
}

function faz(geometria: BufferGeometry) {
  return function Forma({ p, t, c, r, brilha, opacidade, ...resto }: Props) {
    return (
      <mesh
        geometry={geometria}
        material={mat(c, brilha, opacidade)}
        position={p}
        scale={t}
        rotation={r}
        {...resto}
      />
    );
  };
}

export const Bloco = faz(CAIXA);
export const Esfera = faz(ESFERA);
export const Cilindro = faz(CILINDRO);
export const Cone = faz(CONE);
export const Capsula = faz(CAPSULA);
export const Anel = faz(TORUS);
export const Disco = faz(DISCO);
