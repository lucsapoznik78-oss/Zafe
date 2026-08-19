// Tronco, braços, mãos e pernas do cast.
//
// ORIGEM LOCAL: y=0 é a linha do QUADRIL, não o chão. Todo o conjunto acima da
// cintura é filho de um grupo que pivota ali (é assim que `tronco` e
// `desvioQuadril` da pose inclinam o corpo inteiro sem descolar nada), e as
// pernas são filhas da raiz, plantadas no chão. Inclinar o tronco não pode
// levantar um pé.
//
// A ROUPA É CAMADA, NÃO COR (doc §3)
//
// `Tronco` desenha o corpo e, por cima, a peça: um volume ligeiramente maior
// que o torso, com GOLA e BAINHA sempre, mais um elemento funcional (zíper,
// bolso, botões, gravata…). A bainha sai num tom escurecido — é o substituto de
// oclusão ambiente de verdade, e é o que dá espessura ao tecido.
//
// Manga é GEOMETRIA. "curta" e "longa" não são a mesma peça pintada de outro
// jeito: a curta é um punho que termina no meio do bíceps, a longa vai até o
// punho e ganha canhão. Foi o erro nomeado do doc e é o que mais separa o
// moletom da camiseta a 64px.

"use client";

import type { Baixo, Calcado, Roupa } from "@/lib/figura/avatares";

import { Bloco, BlocoMacio, Capsula, Cilindro, Cone, Esfera, Numero } from "../blocos";
import { contraste } from "../primitivas";
import { R, luz, sombra } from "./rig";

const TL = R.torsoL;
const TP = R.torsoP;
const TA = R.torsoA;

type Vec = [number, number, number];

function cor(lista: string[] | undefined, i: number, alt: string): string {
  return lista?.[i] ?? alt;
}

// ---------------------------------------------------------------------------
// MÃO
//
// Palma + bloco de quatro dedos + POLEGAR SEPARADO, em ângulo. O polegar é o
// item da lista de falhas do doc: sem ele a mão é uma bolinha e nada pode ser
// segurado — nem visualmente. Fechada, os dedos viram nós de junta e o polegar
// cruza por cima, que é a forma que lê como punho a qualquer distância.
//
// Origem no PULSO, mão pendurada para −Y. Prop é irmão deste componente dentro
// do mesmo grupo, então ele acompanha o braço de graça.
// ---------------------------------------------------------------------------

export function Mao({ pele, fechada, lado }: { pele: string; fechada?: boolean; lado: -1 | 1 }) {
  const p = pele;
  const s = sombra(pele, 0.88);

  if (fechada) {
    return (
      <group>
        <BlocoMacio p={[0, -0.055, 0]} t={[0.135, 0.13, 0.125]} c={p} />
        {[-0.038, -0.001, 0.036].map((x) => (
          <Esfera key={x} p={[x * -lado, -0.02, 0.05]} t={[0.038, 0.036, 0.04]} c={luz(p, 0.08)} />
        ))}
        <Bloco p={[0, -0.095, 0.03]} t={[0.12, 0.05, 0.09]} c={s} />
        {/* Polegar cruzando os dedos — o traço que faz o punho ser punho. */}
        <Capsula
          p={[0.055 * lado, -0.05, 0.055]}
          t={[0.042, 0.055, 0.042]}
          c={p}
          r={[0.4, 0, lado * 0.9]}
        />
      </group>
    );
  }

  return (
    <group>
      <BlocoMacio p={[0, -0.05, 0]} t={[0.115, 0.1, 0.055]} c={p} />
      {[-0.039, -0.013, 0.013, 0.039].map((x, i) => (
        <Capsula
          key={x}
          p={[x * -lado, -0.115 - (i === 0 || i === 3 ? 0.006 : 0), 0.004]}
          t={[0.024, 0.05 - (i === 3 ? 0.012 : 0), 0.024]}
          c={p}
        />
      ))}
      <Bloco p={[0, -0.098, 0]} t={[0.108, 0.014, 0.05]} c={s} />
      <Capsula p={[0.068 * lado, -0.056, 0.012]} t={[0.03, 0.05, 0.03]} c={p} r={[0, 0, lado * 0.65]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// TRONCO
// ---------------------------------------------------------------------------

function Gola({ tipo, c, det }: { tipo: Roupa["gola"]; c: string; det: string }) {
  const y = TA - 0.02;
  switch (tipo) {
    case "v":
      return (
        <>
          <Bloco p={[-TL * 0.12, y - 0.05, TP * 0.52]} t={[0.1, 0.13, 0.03]} c={det} r={[0, 0, 0.5]} />
          <Bloco p={[TL * 0.12, y - 0.05, TP * 0.52]} t={[0.1, 0.13, 0.03]} c={det} r={[0, 0, -0.5]} />
          <Bloco p={[0, y, -TP * 0.5]} t={[TL * 0.5, 0.045, 0.04]} c={det} />
        </>
      );
    case "camisa":
      return (
        <>
          <Bloco p={[-TL * 0.14, y - 0.04, TP * 0.52]} t={[0.14, 0.1, 0.035]} c={det} r={[0.2, 0, 0.7]} />
          <Bloco p={[TL * 0.14, y - 0.04, TP * 0.52]} t={[0.14, 0.1, 0.035]} c={det} r={[0.2, 0, -0.7]} />
          <Bloco p={[0, y + 0.015, -TP * 0.44]} t={[TL * 0.46, 0.07, 0.06]} c={det} r={[-0.3, 0, 0]} />
        </>
      );
    case "capuz":
      return (
        <>
          <BlocoMacio p={[0, y + 0.02, -TP * 0.42]} t={[TL * 0.78, 0.24, TP * 0.7]} c={det} />
          <Bloco p={[0, y - 0.03, TP * 0.44]} t={[TL * 0.62, 0.09, TP * 0.3]} c={sombra(c, 0.8)} />
        </>
      );
    case "alta":
      return (
        <>
          <Cilindro p={[0, y + 0.06, 0]} t={[0.27, 0.16, 0.27]} c={det} />
          <Cilindro p={[0, y + 0.14, 0]} t={[0.28, 0.03, 0.28]} c={luz(det, 0.2)} />
        </>
      );
    default:
      return (
        <>
          <Cilindro p={[0, y, 0]} t={[0.28, 0.05, 0.28]} c={det} />
          <Cilindro p={[0, y - 0.03, 0]} t={[0.25, 0.03, 0.25]} c={sombra(c, 0.75)} />
        </>
      );
  }
}

function Detalhe({ roupa }: { roupa: Roupa }) {
  const c0 = cor(roupa.cores, 0, "#F2F4F7");
  const c1 = cor(roupa.cores, 1, sombra(c0));
  const c2 = cor(roupa.cores, 2, luz(c0, 0.3));
  const zf = TP * 0.52;

  switch (roupa.detalhe) {
    case "numero":
      return (
        <Numero
          n={roupa.numero ?? 10}
          cor={contraste(c0)}
          p={[0, TA * 0.5, zf + 0.005]}
          t={[0.26, 0.26]}
        />
      );
    case "listras":
      return (
        <>
          {[-0.28, 0, 0.28].map((x) => (
            <Bloco key={x} p={[TL * x, TA * 0.5, zf]} t={[TL * 0.14, TA * 0.94, 0.02]} c={c1} />
          ))}
          <Bloco p={[0, TA * 0.5, -zf]} t={[TL * 0.5, TA * 0.94, 0.02]} c={c1} />
        </>
      );
    case "ziper":
      return (
        <>
          <Bloco p={[0, TA * 0.46, zf]} t={[0.028, TA * 0.9, 0.025]} c={c2} />
          <Bloco p={[0, TA * 0.88, zf + 0.01]} t={[0.05, 0.05, 0.03]} c={luz(c2, 0.35)} />
          <Bloco p={[-0.055, TA * 0.46, zf - 0.004]} t={[0.05, TA * 0.9, 0.02]} c={sombra(c0, 0.8)} />
          <Bloco p={[0.055, TA * 0.46, zf - 0.004]} t={[0.05, TA * 0.9, 0.02]} c={sombra(c0, 0.8)} />
        </>
      );
    case "bolso":
      return (
        <>
          <Bloco p={[0, TA * 0.24, zf + 0.005]} t={[TL * 0.62, TA * 0.26, 0.03]} c={sombra(c0, 0.85)} />
          <Bloco p={[0, TA * 0.36, zf + 0.012]} t={[TL * 0.6, 0.022, 0.03]} c={c1} />
          <Bloco p={[0, TA * 0.24, zf + 0.014]} t={[0.02, TA * 0.24, 0.02]} c={sombra(c0, 0.7)} />
        </>
      );
    case "cordao":
      return (
        <>
          <Capsula p={[-0.06, TA * 0.78, zf]} t={[0.022, 0.13, 0.022]} c={c2} r={[0, 0, 0.12]} />
          <Capsula p={[0.06, TA * 0.74, zf]} t={[0.022, 0.16, 0.022]} c={c2} r={[0, 0, -0.16]} />
          <Bloco p={[-0.064, TA * 0.7, zf]} t={[0.03, 0.03, 0.03]} c={c1} />
          <Bloco p={[0.066, TA * 0.65, zf]} t={[0.03, 0.03, 0.03]} c={c1} />
        </>
      );
    case "botoes":
      return (
        <>
          <Bloco p={[0, TA * 0.46, zf]} t={[0.07, TA * 0.9, 0.022]} c={c1} />
          {[0.72, 0.52, 0.32, 0.14].map((y) => (
            <Esfera key={y} p={[0, TA * y, zf + 0.012]} t={[0.036, 0.036, 0.02]} c={c2} />
          ))}
        </>
      );
    case "gravata":
      return (
        <>
          <Bloco p={[0, TA * 0.78, zf + 0.006]} t={[0.06, 0.06, 0.03]} c={c2} r={[0, 0, 0.78]} />
          <Bloco p={[0, TA * 0.46, zf + 0.004]} t={[0.085, TA * 0.5, 0.026]} c={c2} r={[0, 0, 0.06]} />
          <Bloco p={[0.01, TA * 0.2, zf + 0.004]} t={[0.085, 0.075, 0.026]} c={sombra(c2, 0.8)} r={[0, 0, 0.7]} />
          <Bloco p={[0, TA * 0.46, zf]} t={[0.09, TA * 0.9, 0.02]} c={c1} />
        </>
      );
    case "colete":
      return (
        <>
          <Bloco p={[-TL * 0.3, TA * 0.5, zf]} t={[TL * 0.32, TA * 0.86, 0.035]} c={c1} />
          <Bloco p={[TL * 0.3, TA * 0.5, zf]} t={[TL * 0.32, TA * 0.86, 0.035]} c={c1} />
          <Bloco p={[0, TA * 0.62, zf + 0.01]} t={[TL * 0.94, 0.05, 0.03]} c={c2} brilha />
          <Bloco p={[0, TA * 0.34, zf + 0.01]} t={[TL * 0.94, 0.05, 0.03]} c={c2} brilha />
        </>
      );
    case "cinturao":
      return (
        <>
          <Bloco p={[0, TA * 0.1, 0]} t={[TL * 1.06, 0.09, TP * 1.06]} c={c1} />
          <Bloco p={[0, TA * 0.1, zf + 0.01]} t={[0.11, 0.11, 0.035]} c={c2} />
          <Bloco p={[0, TA * 0.1, zf + 0.022]} t={[0.05, 0.05, 0.02]} c={sombra(c1, 0.7)} />
        </>
      );
    case "medalha":
      return (
        <>
          <Bloco p={[-0.07, TA * 0.7, zf]} t={[0.024, 0.24, 0.02]} c={c1} r={[0, 0, 0.28]} />
          <Bloco p={[0.07, TA * 0.7, zf]} t={[0.024, 0.24, 0.02]} c={c1} r={[0, 0, -0.28]} />
          <Cilindro p={[0, TA * 0.52, zf + 0.012]} t={[0.11, 0.022, 0.11]} c={c2} r={[Math.PI / 2, 0, 0]} brilha />
          <Cilindro p={[0, TA * 0.52, zf + 0.024]} t={[0.07, 0.016, 0.07]} c={luz(c2, 0.3)} r={[Math.PI / 2, 0, 0]} />
        </>
      );
    case "peitoral":
      return (
        <>
          <BlocoMacio p={[0, TA * 0.58, zf - 0.01]} t={[TL * 0.84, TA * 0.5, 0.07]} c={c1} />
          <Bloco p={[0, TA * 0.58, zf + 0.03]} t={[TL * 0.34, TA * 0.2, 0.03]} c={c2} brilha />
          <Bloco p={[-TL * 0.34, TA * 0.58, zf - 0.01]} t={[0.05, TA * 0.46, 0.08]} c={c2} />
          <Bloco p={[TL * 0.34, TA * 0.58, zf - 0.01]} t={[0.05, TA * 0.46, 0.08]} c={c2} />
        </>
      );
    default:
      return null;
  }
}

/** Bases que caem em saia — a peça continua abaixo da cintura. */
const SAIA_BASE: ReadonlySet<Roupa["base"]> = new Set(["vestido", "manto", "roupao", "macacao", "espacial"]);

export function Tronco({ roupa, pele }: { roupa: Roupa; pele: string }) {
  const c0 = cor(roupa.cores, 0, "#F2F4F7");
  const c1 = cor(roupa.cores, 1, sombra(c0));
  const c2 = cor(roupa.cores, 2, luz(c0, 0.3));

  // Regata e collant não escondem o ombro; a peça é mais estreita e o tronco
  // de pele aparece dos lados. É por isso que o corpo é desenhado sempre.
  const larga = roupa.base === "jaqueta" || roupa.base === "pelucia" || roupa.base === "roupao";
  const estreita = roupa.base === "regata" || roupa.base === "collant";
  const fator = larga ? 1.1 : estreita ? 0.86 : 1.02;

  return (
    <group>
      {/* Corpo. */}
      <BlocoMacio p={[0, TA * 0.5, 0]} t={[TL, TA, TP]} c={pele} />
      <Cilindro p={[0, TA + R.pescocoA * 0.5, 0]} t={[R.pescocoR * 2, R.pescocoA + 0.04, R.pescocoR * 2]} c={sombra(pele, 0.94)} />

      {/* Peça. */}
      <BlocoMacio p={[0, TA * 0.5, 0]} t={[TL * fator, TA * 0.97, TP * fator]} c={c0} />
      {/* Bainha: o tom escuro é o que dá espessura ao tecido. */}
      <Bloco p={[0, TA * 0.035, 0]} t={[TL * fator + 0.012, 0.05, TP * fator + 0.012]} c={sombra(c0, 0.7)} />
      {/* Vinco lateral — quebra o retângulo. */}
      <Bloco p={[-TL * fator * 0.5, TA * 0.5, 0]} t={[0.015, TA * 0.8, TP * fator * 0.9]} c={sombra(c0, 0.84)} />
      <Bloco p={[TL * fator * 0.5, TA * 0.5, 0]} t={[0.015, TA * 0.8, TP * fator * 0.9]} c={sombra(c0, 0.84)} />

      {SAIA_BASE.has(roupa.base) && (
        <>
          <Cone p={[0, -0.16, 0]} t={[TL * 1.5, 0.62, TP * 2.3]} c={c0} r={[Math.PI, 0, 0]} />
          <Cilindro p={[0, -0.44, 0]} t={[TL * 1.48, 0.05, TP * 2.28]} c={sombra(c0, 0.72)} />
        </>
      )}

      <Gola tipo={roupa.gola} c={c0} det={c1} />
      <Detalhe roupa={roupa} />
      {/* Rim light: uma faixa clara na quina de trás. Um só plano e a peça
          deixa de ser chapada. */}
      <Bloco p={[0, TA * 0.55, -TP * fator * 0.5]} t={[TL * fator * 0.9, TA * 0.5, 0.012]} c={luz(c0, 0.12)} />
      <Bloco p={[0, TA * 0.9, 0]} t={[TL * fator * 0.98, 0.03, TP * fator * 0.98]} c={c2} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// BRAÇO
// ---------------------------------------------------------------------------

export function Braco({
  lado,
  roupa,
  pele,
  ombro,
  cotovelo,
  punho,
  children,
}: {
  lado: -1 | 1;
  roupa: Roupa;
  pele: string;
  ombro: Vec;
  cotovelo: Vec;
  punho?: boolean;
  /** O prop da mão entra aqui: filho do punho, acompanha o braço sem conta. */
  children?: React.ReactNode;
}) {
  const c0 = cor(roupa.cores, 0, "#F2F4F7");
  const c1 = cor(roupa.cores, 1, sombra(c0));
  const r = R.bracoR;
  const manga = roupa.manga;

  return (
    <group position={[lado * R.xOmbro, TA - 0.05, 0]} rotation={ombro}>
      {/* Ombro: a esfera é o que impede a junta de abrir um buraco quando o
          braço levanta 150°. */}
      <Esfera p={[0, 0, 0]} t={[r * 2.4, r * 2.4, r * 2.4]} c={manga === "sem" ? pele : c0} />

      <Capsula p={[0, -R.bracoA * 0.5, 0]} t={[r * 2, R.bracoA * 0.8, r * 2]} c={pele} />

      {manga !== "sem" && (
        <>
          {/* Curta: termina no meio do bíceps, com PUNHO — não é a longa cortada. */}
          <Capsula
            p={[0, -R.bracoA * (manga === "curta" ? 0.3 : 0.5), 0]}
            t={[r * 2.5, R.bracoA * (manga === "curta" ? 0.42 : 0.84), r * 2.5]}
            c={c0}
          />
          <Cilindro
            p={[0, -R.bracoA * (manga === "curta" ? 0.56 : 0.98), 0]}
            t={[r * 2.62, 0.035, r * 2.62]}
            c={c1}
          />
        </>
      )}

      <group position={[0, -R.bracoA, 0]} rotation={cotovelo}>
        <Esfera p={[0, 0, 0]} t={[r * 2.1, r * 2.1, r * 2.1]} c={manga === "longa" ? c0 : pele} />
        <Capsula p={[0, -R.antebracoA * 0.5, 0]} t={[r * 1.86, R.antebracoA * 0.76, r * 1.86]} c={pele} />

        {manga === "longa" && (
          <>
            <Capsula p={[0, -R.antebracoA * 0.46, 0]} t={[r * 2.28, R.antebracoA * 0.7, r * 2.28]} c={c0} />
            {/* Canhão: a dobra do punho. */}
            <Cilindro p={[0, -R.antebracoA * 0.86, 0]} t={[r * 2.4, 0.05, r * 2.4]} c={c1} />
          </>
        )}

        <group position={[0, -(R.antebracoA + 0.05), 0]}>
          <Mao pele={pele} fechada={punho} lado={lado} />
          {children}
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// PERNA
//
// Origem no QUADRIL, y para baixo. Coxa → joelho → canela → pé. O joelho é
// esfera pelo mesmo motivo do ombro.
// ---------------------------------------------------------------------------

function Pe({ calcado, pele, lado }: { calcado: Calcado; pele: string; lado: -1 | 1 }) {
  const c0 = cor(calcado.cores, 0, "#F2F4F7");
  const c1 = cor(calcado.cores, 1, sombra(c0));
  const y = -0.05;

  switch (calcado.tipo) {
    case "descalco":
      return (
        <>
          <BlocoMacio p={[0, y, 0.07]} t={[0.15, 0.1, 0.26]} c={pele} />
          {[-0.04, -0.013, 0.014, 0.04].map((x) => (
            <Esfera key={x} p={[x * -lado, y - 0.01, 0.19]} t={[0.026, 0.03, 0.035]} c={luz(pele, 0.06)} />
          ))}
        </>
      );
    case "chuteira":
      return (
        <>
          <BlocoMacio p={[0, y, 0.08]} t={[0.17, 0.11, 0.3]} c={c0} />
          <Bloco p={[0, y - 0.055, 0.08]} t={[0.175, 0.028, 0.3]} c={c1} />
          {[-0.05, 0.05].map((x) =>
            [0.0, 0.16].map((z) => (
              <Cone key={`${x}-${z}`} p={[x, y - 0.078, z]} t={[0.03, 0.035, 0.03]} c={c1} r={[Math.PI, 0, 0]} />
            )),
          )}
          <Bloco p={[0, y + 0.02, 0.16]} t={[0.1, 0.05, 0.12]} c={c1} r={[0.2, 0, 0]} />
        </>
      );
    case "bota":
      return (
        <>
          <BlocoMacio p={[0, y + 0.11, -0.01]} t={[0.19, 0.34, 0.2]} c={c0} />
          <BlocoMacio p={[0, y, 0.07]} t={[0.19, 0.13, 0.3]} c={c0} />
          <Bloco p={[0, y - 0.065, 0.06]} t={[0.2, 0.04, 0.31]} c={c1} />
          <Bloco p={[0, y - 0.045, -0.09]} t={[0.19, 0.07, 0.1]} c={c1} />
          <Bloco p={[0, y + 0.24, 0]} t={[0.2, 0.05, 0.21]} c={c1} />
        </>
      );
    case "sapato":
      return (
        <>
          <BlocoMacio p={[0, y, 0.07]} t={[0.15, 0.09, 0.28]} c={c0} />
          <Bloco p={[0, y - 0.045, 0.06]} t={[0.155, 0.025, 0.29]} c={sombra(c0, 0.6)} />
          <Bloco p={[0, y + 0.02, -0.02]} t={[0.14, 0.07, 0.1]} c={luz(c0, 0.12)} />
        </>
      );
    case "sapatilha":
      return (
        <>
          <BlocoMacio p={[0, y - 0.01, 0.06]} t={[0.14, 0.07, 0.25]} c={c0} />
          <Bloco p={[0, y + 0.03, -0.02]} t={[0.145, 0.06, 0.09]} c={c1} />
          <Capsula p={[0, y + 0.14, -0.02]} t={[0.02, 0.14, 0.02]} c={c1} r={[0.3, 0, 0.25]} />
        </>
      );
    case "patas":
      return (
        <>
          <BlocoMacio p={[0, y, 0.06]} t={[0.22, 0.14, 0.3]} c={c0} />
          {[-0.06, 0, 0.06].map((x) => (
            <Esfera key={x} p={[x, y - 0.03, 0.19]} t={[0.06, 0.05, 0.07]} c={c1} />
          ))}
          <Esfera p={[0, y - 0.04, 0.06]} t={[0.12, 0.05, 0.12]} c={c1} />
        </>
      );
    default:
      // tênis
      return (
        <>
          <BlocoMacio p={[0, y, 0.07]} t={[0.18, 0.13, 0.3]} c={c0} />
          <Bloco p={[0, y - 0.06, 0.07]} t={[0.19, 0.045, 0.31]} c={c1} />
          <Bloco p={[0, y - 0.078, 0.07]} t={[0.185, 0.02, 0.305]} c={sombra(c1, 0.7)} />
          <Bloco p={[0, y + 0.035, 0.13]} t={[0.1, 0.06, 0.14]} c={sombra(c0, 0.82)} r={[0.15, 0, 0]} />
          {/* Cadarço. */}
          {[0.09, 0.14].map((z) => (
            <Bloco key={z} p={[0, y + 0.06, z]} t={[0.09, 0.016, 0.02]} c={luz(c0, 0.4)} />
          ))}
          <Bloco p={[0, y + 0.02, -0.075]} t={[0.17, 0.09, 0.03]} c={c1} />
        </>
      );
  }
}

export function Perna({
  lado,
  baixo,
  calcado,
  pele,
  giro,
}: {
  lado: -1 | 1;
  baixo: Baixo;
  calcado: Calcado;
  pele: string;
  giro: Vec;
}) {
  const b0 = cor(baixo.cores, 0, "#26364B");
  const b1 = cor(baixo.cores, 1, sombra(b0));
  const r = R.pernaR;
  const t = baixo.tipo;

  // Quanto da perna a peça cobre, do quadril para baixo.
  const cobreCoxa = t !== "nenhum";
  const cobreCanela = t === "calca";
  const curto = t === "shorts" || t === "calcao" || t === "meiao";

  return (
    <group position={[lado * R.xQuadril, 0, 0]} rotation={giro}>
      <Capsula p={[0, -R.coxaA * 0.5, 0]} t={[r * 2.1, R.coxaA * 0.72, r * 2.1]} c={pele} />

      {cobreCoxa && t !== "saia" && (
        <>
          <Capsula
            p={[0, -R.coxaA * (curto ? 0.36 : 0.5), 0]}
            t={[r * 2.5, R.coxaA * (curto ? 0.52 : 0.86), r * 2.5]}
            c={b0}
          />
          <Cilindro
            p={[0, -R.coxaA * (curto ? 0.66 : 1.0), 0]}
            t={[r * 2.62, 0.04, r * 2.62]}
            c={sombra(b0, 0.7)}
          />
          <Bloco p={[lado * r * 1.2, -R.coxaA * 0.4, 0]} t={[0.014, R.coxaA * 0.6, r * 2.2]} c={b1} />
        </>
      )}

      {t === "saia" && (
        <Cone p={[0, -0.22, 0]} t={[r * 6, 0.5, r * 6]} c={b0} r={[Math.PI, 0, 0]} />
      )}

      <group position={[0, -R.coxaA, 0]}>
        <Esfera p={[0, 0, 0]} t={[r * 2.2, r * 2.2, r * 2.2]} c={cobreCanela ? b0 : pele} />
        <Capsula p={[0, -R.canelaA * 0.5, 0]} t={[r * 1.86, R.canelaA * 0.7, r * 1.86]} c={pele} />

        {cobreCanela && (
          <>
            <Capsula p={[0, -R.canelaA * 0.46, 0]} t={[r * 2.36, R.canelaA * 0.66, r * 2.36]} c={b0} />
            {/* Bainha da calça, dobrada. */}
            <Cilindro p={[0, -R.canelaA * 0.86, 0]} t={[r * 2.5, 0.055, r * 2.5]} c={sombra(b0, 0.72)} />
          </>
        )}

        {t === "meiao" && (
          <>
            <Capsula p={[0, -R.canelaA * 0.52, 0]} t={[r * 2.1, R.canelaA * 0.62, r * 2.1]} c={b1} />
            <Cilindro p={[0, -R.canelaA * 0.14, 0]} t={[r * 2.2, 0.05, r * 2.2]} c={luz(b1, 0.3)} />
          </>
        )}

        <group position={[0, -R.canelaA - 0.02, 0]}>
          <Pe calcado={calcado} pele={pele} lado={lado} />
        </group>
      </group>
    </group>
  );
}
