// Cabeça do cast: cabelo, rosto, chapéu, acessório de rosto.
//
// TUDO AQUI É DESENHADO EM COORDENADA LOCAL DA CABEÇA: origem no CENTRO do cubo
// craniano, +Z é para onde o personagem olha, +Y é o topo. Quem posiciona a
// cabeça no corpo (e quem a inclina, na pose) é `Avatar3D.tsx`. Sem essa
// separação, cada chapéu teria embutido um palpite de onde a cabeça está e
// trocar de pose descolaria tudo.
//
// POR QUE A CONTA DE MALHAS É MAIOR AQUI DO QUE NO BONECO MONTÁVEL
//
// O boneco montável orça ~40 malhas porque ele é montado ao vivo e convive com
// a loja. O avatar pronto é um objeto fechado, um por tela, `frameloop="demand"`
// — ele só desenha quando o usuário gira. Gastar ~50 malhas na cabeça é o que
// compra o "detalhista" pedido: gradiente de cabelo em três paradas, mecha,
// banda de brilho, olho com pálpebra, sobrancelha independente por lado.
// Geometria e material continuam vindo do cache de `primitivas.ts`, então o
// custo real é de draw call, não de memória.
//
// A ASSIMETRIA É OBRIGATÓRIA (doc §3). `rosto.lado` diz de que lado ela cai:
// −1 é a direita DELE. Um rosto simétrico é o que faz trinta personagens
// lerem como o mesmo personagem.

"use client";

import type { Cabelo, Chapeu, Face, Rosto } from "@/lib/figura/avatares";

import { Anel, Bloco, BlocoMacio, Capsula, Cilindro, Cone, Disco, Esfera } from "../blocos";
import { R, luz, sombra } from "./rig";

const C = R.cabeca;
const H = C / 2;

/** Plano do rosto. Cada camada de decalque sobe 2mm para não brigar em Z. */
const Z0 = H + 0.004;
const Z1 = Z0 + 0.003;
const Z2 = Z1 + 0.003;

/** Índice seguro numa lista de cores vinda do catálogo. */
function cor(lista: string[] | undefined, i: number, alt: string): string {
  return lista?.[i] ?? alt;
}

// ---------------------------------------------------------------------------
// CABELO
//
// Três paradas de cor, sempre: raiz no topo (cores[0]), massa nas laterais e na
// nuca (cores[1]), pontas (cores[2]). Mais duas coisas que o doc exige e que
// são o que separa "capacete de cabelo" de cabelo: MECHAS (tiras finas num tom
// clareado, quebrando a superfície) e uma BANDA DE BRILHO na curva do crânio.
//
// `achatado` é o cabelo sob chapéu: some o volume do topo e as pontas de pé,
// ficam as laterais, a nuca e o rabo/trança. Sem isso o boné flutua.
// ---------------------------------------------------------------------------

function Banda({ c }: { c: string }) {
  return <Bloco p={[0, H * 0.56, C * 0.28]} t={[C * 0.6, C * 0.05, C * 0.46]} c={luz(c, 0.34)} />;
}

function Mechas({ c }: { c: string }) {
  const m = luz(c, 0.22);
  return (
    <>
      <Bloco p={[-C * 0.26, H * 0.5, C * 0.34]} t={[C * 0.07, C * 0.3, C * 0.24]} c={m} r={[0.2, 0, 0.24]} />
      <Bloco p={[C * 0.12, H * 0.54, C * 0.36]} t={[C * 0.05, C * 0.24, C * 0.2]} c={m} r={[0.18, 0, -0.16]} />
      <Bloco p={[C * 0.36, H * 0.34, -C * 0.1]} t={[C * 0.05, C * 0.34, C * 0.16]} c={m} r={[0, 0, -0.1]} />
    </>
  );
}

/** Casquete comum a quase todos os estilos: topo, laterais e nuca. */
function Base({ raiz, meio }: { raiz: string; meio: string }) {
  return (
    <>
      <BlocoMacio p={[0, H * 0.44, 0]} t={[C * 1.05, C * 0.46, C * 1.05]} c={raiz} />
      <Bloco p={[-C * 0.5, H * 0.06, -C * 0.04]} t={[C * 0.11, C * 0.52, C * 0.94]} c={meio} />
      <Bloco p={[C * 0.5, H * 0.06, -C * 0.04]} t={[C * 0.11, C * 0.52, C * 0.94]} c={meio} />
      <Bloco p={[0, H * 0.1, -C * 0.5]} t={[C * 1.02, C * 0.6, C * 0.12]} c={meio} />
    </>
  );
}

export function CabeloAvatar({ cabelo, achatado }: { cabelo: Cabelo; achatado?: boolean }) {
  const [raiz, meio, ponta] = cabelo.cores;
  const e = cabelo.estilo;

  if (e === "careca") {
    // Careca não é ausência de cabelo: é o brilho do couro cabeludo e a coroa
    // rala acima da orelha. Sem isso o crânio lê como bola de plástico.
    return (
      <>
        <Bloco p={[-C * 0.48, -H * 0.02, -C * 0.08]} t={[C * 0.09, C * 0.2, C * 0.7]} c={meio} />
        <Bloco p={[C * 0.48, -H * 0.02, -C * 0.08]} t={[C * 0.09, C * 0.2, C * 0.7]} c={meio} />
        <Bloco p={[0, H * 0.02, -C * 0.48]} t={[C * 0.8, C * 0.2, C * 0.1]} c={meio} />
        <Bloco p={[0, H * 0.66, C * 0.12]} t={[C * 0.34, C * 0.04, C * 0.4]} c={luz(raiz, 0.3)} />
      </>
    );
  }

  const topo = !achatado;

  return (
    <>
      <Base raiz={raiz} meio={meio} />
      {topo && <Banda c={raiz} />}
      <Mechas c={meio} />

      {e === "curto" && (
        <>
          <Bloco p={[0, H * 0.36, C * 0.46]} t={[C * 0.92, C * 0.3, C * 0.16]} c={raiz} />
          <Bloco p={[-C * 0.3, H * 0.28, C * 0.48]} t={[C * 0.3, C * 0.14, C * 0.14]} c={ponta} r={[0, 0, 0.22]} />
        </>
      )}

      {e === "espetado" &&
        topo &&
        [-0.32, -0.11, 0.1, 0.31].map((x, i) => (
          <Cone
            key={x}
            p={[C * x, H * (0.86 + (i % 2) * 0.1), C * (i % 2 ? 0.06 : -0.12)]}
            t={[C * 0.22, C * (0.36 + (i % 2) * 0.12), C * 0.22]}
            c={ponta}
            r={[i % 2 ? -0.24 : 0.18, 0, i < 2 ? 0.26 : -0.3]}
          />
        ))}

      {e === "afro" && (
        <>
          <Esfera p={[0, H * 0.6, -C * 0.04]} t={[C * 1.46, C * 1.16, C * 1.4]} c={meio} />
          <Esfera p={[-C * 0.58, H * 0.18, -C * 0.06]} t={[C * 0.62, C * 0.66, C * 0.72]} c={raiz} />
          <Esfera p={[C * 0.58, H * 0.18, -C * 0.06]} t={[C * 0.62, C * 0.66, C * 0.72]} c={raiz} />
          <Esfera p={[0, H * 1.02, C * 0.3]} t={[C * 0.5, C * 0.4, C * 0.44]} c={luz(ponta, 0.18)} />
        </>
      )}

      {e === "longo" && (
        <>
          <Bloco p={[0, -H * 0.7, -C * 0.44]} t={[C * 0.96, C * 1.5, C * 0.22]} c={meio} />
          <Bloco p={[0, -H * 1.42, -C * 0.44]} t={[C * 0.86, C * 0.3, C * 0.2]} c={ponta} />
          <Bloco p={[-C * 0.48, -H * 0.32, C * 0.18]} t={[C * 0.18, C * 1.0, C * 0.42]} c={meio} />
          <Bloco p={[C * 0.48, -H * 0.5, C * 0.18]} t={[C * 0.16, C * 1.3, C * 0.42]} c={meio} />
          <Bloco p={[C * 0.48, -H * 1.16, C * 0.18]} t={[C * 0.15, C * 0.24, C * 0.4]} c={ponta} />
        </>
      )}

      {e === "rabo" && (
        <>
          <Cilindro p={[0, H * 0.1, -C * 0.62]} t={[C * 0.3, C * 0.2, C * 0.3]} c={meio} r={[Math.PI / 2, 0, 0]} />
          <Capsula p={[0, -H * 0.42, -C * 0.78]} t={[C * 0.26, C * 0.6, C * 0.26]} c={meio} r={[-0.3, 0, 0]} />
          <Capsula p={[0, -H * 1.02, -C * 0.9]} t={[C * 0.2, C * 0.4, C * 0.2]} c={ponta} r={[-0.24, 0, 0]} />
          <Bloco p={[0, H * 0.14, -C * 0.62]} t={[C * 0.34, C * 0.1, C * 0.16]} c={sombra(meio, 0.7)} />
        </>
      )}

      {e === "coque" && (
        <>
          <Esfera p={[0, H * (topo ? 1.0 : 0.7), -C * 0.32]} t={[C * 0.54, C * 0.5, C * 0.5]} c={meio} />
          <Anel
            p={[0, H * (topo ? 0.86 : 0.56), -C * 0.32]}
            t={[C * 0.44, C * 0.44, C * 0.44]}
            c={sombra(raiz, 0.72)}
            r={[Math.PI / 2, 0, 0]}
          />
          <Bloco p={[-C * 0.44, -H * 0.18, C * 0.24]} t={[C * 0.1, C * 0.5, C * 0.24]} c={ponta} />
        </>
      )}

      {e === "franja" && (
        <>
          <Bloco p={[0, H * 0.3, C * 0.48]} t={[C * 0.98, C * 0.42, C * 0.18]} c={raiz} />
          <Bloco p={[-C * 0.2, H * 0.12, C * 0.5]} t={[C * 0.5, C * 0.16, C * 0.16]} c={ponta} r={[0, 0, -0.14]} />
          <Bloco p={[C * 0.32, H * 0.16, C * 0.5]} t={[C * 0.34, C * 0.14, C * 0.16]} c={ponta} r={[0, 0, 0.18]} />
        </>
      )}

      {e === "chanel" && (
        <>
          <Bloco p={[-C * 0.5, -H * 0.34, C * 0.02]} t={[C * 0.2, C * 1.1, C * 0.9]} c={meio} />
          <Bloco p={[C * 0.5, -H * 0.34, C * 0.02]} t={[C * 0.2, C * 1.1, C * 0.9]} c={meio} />
          <Bloco p={[-C * 0.5, -H * 0.86, C * 0.02]} t={[C * 0.19, C * 0.16, C * 0.88]} c={ponta} />
          <Bloco p={[C * 0.5, -H * 0.86, C * 0.02]} t={[C * 0.19, C * 0.16, C * 0.88]} c={ponta} />
          <Bloco p={[0, -H * 0.34, -C * 0.5]} t={[C * 1.02, C * 1.1, C * 0.18]} c={meio} />
          <Bloco p={[0, H * 0.32, C * 0.48]} t={[C * 0.96, C * 0.36, C * 0.16]} c={raiz} />
        </>
      )}

      {e === "salgado" && (
        <>
          {[-0.34, 0, 0.34].map((x, i) => (
            <Esfera
              key={x}
              p={[C * x, H * (topo ? 0.78 : 0.5), C * (0.1 - i * 0.16)]}
              t={[C * 0.46, C * 0.34, C * 0.44]}
              c={i === 1 ? luz(meio, 0.14) : meio}
            />
          ))}
          <Bloco p={[-C * 0.46, -H * 0.24, C * 0.06]} t={[C * 0.16, C * 0.8, C * 0.6]} c={meio} />
          <Bloco p={[C * 0.46, -H * 0.16, C * 0.06]} t={[C * 0.16, C * 0.64, C * 0.6]} c={meio} />
          <Bloco p={[0, -H * 0.66, -C * 0.44]} t={[C * 0.9, C * 0.28, C * 0.2]} c={luz(ponta, 0.24)} />
        </>
      )}

      {e === "grisalho" && (
        <>
          {/* Entradas: o cabelo recua no alto da testa e sobra nas têmporas. */}
          <Bloco p={[-C * 0.34, H * 0.4, C * 0.44]} t={[C * 0.32, C * 0.26, C * 0.18]} c={raiz} />
          <Bloco p={[C * 0.34, H * 0.4, C * 0.44]} t={[C * 0.32, C * 0.26, C * 0.18]} c={raiz} />
          <Bloco p={[-C * 0.5, -H * 0.16, C * 0.1]} t={[C * 0.12, C * 0.36, C * 0.5]} c={ponta} />
          <Bloco p={[C * 0.5, -H * 0.16, C * 0.1]} t={[C * 0.12, C * 0.36, C * 0.5]} c={ponta} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ROSTO
//
// Olho é feito em três camadas — branco, íris, pupila — mais uma PÁLPEBRA que é
// o que dá expressão. Trocar a expressão trocando só a pálpebra (e não o olho
// inteiro) é o que mantém o cast coerente: todo mundo tem o mesmo olho, com
// humor diferente por cima.
// ---------------------------------------------------------------------------

const OLHO_X = C * 0.2;
const OLHO_Y = C * 0.02;
const OLHO_L = C * 0.155;

type Expressao = Rosto["olhos"];

function Olho({ x, tipo, iris, pele }: { x: number; tipo: Expressao; iris: string; pele: string }) {
  if (tipo === "fechado" || tipo === "sereno") {
    // Linha curva: dois traços inclinados encostados formam a pálpebra fechada.
    return (
      <>
        <Bloco p={[x - OLHO_L * 0.28, OLHO_Y, Z1]} t={[OLHO_L * 0.66, C * 0.028, 0.012]} c="#2A2118" r={[0, 0, 0.28]} />
        <Bloco p={[x + OLHO_L * 0.28, OLHO_Y, Z1]} t={[OLHO_L * 0.66, C * 0.028, 0.012]} c="#2A2118" r={[0, 0, -0.28]} />
      </>
    );
  }

  const grande = tipo === "surpreso";
  const alt = grande ? OLHO_L * 1.28 : OLHO_L;

  return (
    <>
      <Disco p={[x, OLHO_Y, Z0]} t={[OLHO_L * (grande ? 1.2 : 1), alt, 1]} c="#FBFCFD" />
      <Disco p={[x, OLHO_Y, Z1]} t={[OLHO_L * 0.62, alt * 0.62, 1]} c={iris} />
      <Disco p={[x, OLHO_Y, Z2]} t={[OLHO_L * 0.3, alt * 0.3, 1]} c="#14151A" />
      {/* O ponto de luz. Um pixel branco fora do centro é o que faz o olho
          parecer molhado em vez de adesivo. */}
      <Disco p={[x + OLHO_L * 0.2, OLHO_Y + alt * 0.22, Z2 + 0.002]} t={[OLHO_L * 0.16, alt * 0.16, 1]} c="#FFFFFF" />

      {tipo === "feliz" && (
        <Bloco p={[x, OLHO_Y - alt * 0.1, Z2 + 0.004]} t={[OLHO_L * 1.3, alt * 0.7, 0.014]} c={pele} />
      )}
      {tipo === "sono" && (
        <Bloco p={[x, OLHO_Y + alt * 0.3, Z2 + 0.004]} t={[OLHO_L * 1.3, alt * 0.62, 0.014]} c={pele} />
      )}
      {(tipo === "bravo" || tipo === "determinado") && (
        <Bloco
          p={[x, OLHO_Y + alt * 0.42, Z2 + 0.004]}
          t={[OLHO_L * 1.45, alt * (tipo === "bravo" ? 0.6 : 0.44), 0.014]}
          c={pele}
          r={[0, 0, x < 0 ? -0.4 : 0.4]}
        />
      )}
    </>
  );
}

const SOBRANCELHA_Y = C * 0.19;

function Sobrancelha({ x, tipo, cor: c }: { x: number; tipo: Rosto["sobrancelha"]; cor: string }) {
  const giro =
    tipo === "brava" ? (x < 0 ? -0.34 : 0.34) : tipo === "torta" ? 0.26 : tipo === "erguida" ? 0.1 : 0.04;
  const alto = tipo === "erguida" ? C * 0.07 : 0;
  return (
    <Bloco
      p={[x, SOBRANCELHA_Y + alto, Z1]}
      t={[C * 0.2, C * 0.042, 0.016]}
      c={c}
      r={[0, 0, x < 0 ? giro : -giro]}
    />
  );
}

function Boca({ tipo }: { tipo: Rosto["boca"] }) {
  const y = -C * 0.19;
  if (tipo === "serio") return <Bloco p={[0, y, Z0]} t={[C * 0.2, C * 0.028, 0.014]} c="#8C4A42" />;
  if (tipo === "bico")
    return <Esfera p={[0, y, Z0 + 0.01]} t={[C * 0.1, C * 0.09, C * 0.06]} c="#B4564C" />;
  if (tipo === "aberta")
    return (
      <>
        <Esfera p={[0, y, Z0]} t={[C * 0.19, C * 0.2, C * 0.08]} c="#5E2621" />
        <Bloco p={[0, y + C * 0.07, Z0 + 0.02]} t={[C * 0.16, C * 0.035, 0.014]} c="#FBFCFD" />
        <Esfera p={[0, y - C * 0.06, Z0 + 0.02]} t={[C * 0.1, C * 0.06, C * 0.04]} c="#C05B58" />
      </>
    );
  if (tipo === "dentes")
    return (
      <>
        <Bloco p={[0, y, Z0]} t={[C * 0.28, C * 0.11, 0.014]} c="#5E2621" />
        <Bloco p={[0, y + C * 0.02, Z1]} t={[C * 0.26, C * 0.06, 0.014]} c="#FBFCFD" />
        <Bloco p={[0, y - C * 0.045, Z1]} t={[C * 0.2, C * 0.02, 0.014]} c="#E9EAEE" />
      </>
    );

  // sorriso / sorrisoTorto: três traços em degrau. Curva de verdade custaria
  // uma geometria própria por boca; o degrau lê como curva a 64px, que é o
  // teste de silhueta do doc.
  const torto = tipo === "sorrisoTorto";
  return (
    <>
      <Bloco p={[0, y, Z0]} t={[C * 0.17, C * 0.035, 0.014]} c="#8C4A42" />
      <Bloco p={[-C * 0.11, y + C * 0.028, Z0]} t={[C * 0.08, C * 0.032, 0.014]} c="#8C4A42" r={[0, 0, 0.5]} />
      <Bloco
        p={[C * 0.11, y + C * (torto ? 0.075 : 0.028), Z0]}
        t={[C * 0.08, C * 0.032, 0.014]}
        c="#8C4A42"
        r={[0, 0, torto ? -0.9 : -0.5]}
      />
    </>
  );
}

function Barba({ tipo, cor: c }: { tipo: NonNullable<Rosto["barba"]>["tipo"]; cor: string }) {
  const s = sombra(c, 0.82);
  if (tipo === "bigode")
    return (
      <>
        <Bloco p={[0, -C * 0.11, Z0]} t={[C * 0.32, C * 0.06, C * 0.05]} c={c} />
        <Bloco p={[-C * 0.16, -C * 0.125, Z0]} t={[C * 0.09, C * 0.05, C * 0.05]} c={s} r={[0, 0, 0.3]} />
        <Bloco p={[C * 0.16, -C * 0.125, Z0]} t={[C * 0.09, C * 0.05, C * 0.05]} c={s} r={[0, 0, -0.3]} />
      </>
    );
  if (tipo === "cavanhaque")
    return (
      <>
        <Bloco p={[0, -C * 0.11, Z0]} t={[C * 0.28, C * 0.05, C * 0.05]} c={c} />
        <Bloco p={[0, -C * 0.34, Z0 - 0.01]} t={[C * 0.16, C * 0.16, C * 0.06]} c={c} />
        <Bloco p={[0, -C * 0.26, Z0 - 0.01]} t={[C * 0.09, C * 0.1, C * 0.05]} c={s} />
      </>
    );
  if (tipo === "costeleta")
    return (
      <>
        <Bloco p={[-C * 0.47, -C * 0.06, C * 0.12]} t={[C * 0.09, C * 0.34, C * 0.24]} c={c} />
        <Bloco p={[C * 0.47, -C * 0.06, C * 0.12]} t={[C * 0.09, C * 0.34, C * 0.24]} c={c} />
        <Bloco p={[-C * 0.47, -C * 0.24, C * 0.12]} t={[C * 0.085, C * 0.1, C * 0.22]} c={s} />
        <Bloco p={[C * 0.47, -C * 0.24, C * 0.12]} t={[C * 0.085, C * 0.1, C * 0.22]} c={s} />
      </>
    );
  // cheia
  return (
    <>
      <BlocoMacio p={[0, -C * 0.3, C * 0.08]} t={[C * 0.94, C * 0.5, C * 0.9]} c={c} />
      <Bloco p={[0, -C * 0.52, C * 0.16]} t={[C * 0.5, C * 0.22, C * 0.5]} c={sombra(c, 0.86)} />
      <Bloco p={[0, -C * 0.11, Z0]} t={[C * 0.3, C * 0.06, C * 0.06]} c={luz(c, 0.12)} />
      {/* A boca é escavada na barba: sem esse vão a barba engole a expressão. */}
      <Bloco p={[0, -C * 0.19, Z0 - 0.006]} t={[C * 0.34, C * 0.12, C * 0.04]} c={sombra(c, 0.6)} />
    </>
  );
}

export function RostoAvatar({
  rosto,
  pele,
  cabeloCor,
  semOlhos,
}: {
  rosto: Rosto;
  pele: string;
  /** Raiz do cabelo — a sobrancelha sai daí, nunca de um preto fixo. */
  cabeloCor: string;
  semOlhos?: boolean;
}) {
  const iris = sombra(cabeloCor, 0.9);
  const l = rosto.lado;
  const sobrancelha = rosto.barba?.cor ?? sombra(cabeloCor, 0.86);

  return (
    <>
      {/* Nariz — pequeno, mas é ele que tira o rosto do plano. */}
      <Bloco p={[0, -C * 0.05, H + C * 0.028]} t={[C * 0.075, C * 0.12, C * 0.07]} c={luz(pele, 0.06)} />
      <Bloco p={[0, -C * 0.11, H + C * 0.02]} t={[C * 0.09, C * 0.02, C * 0.05]} c={sombra(pele, 0.86)} />

      {/* Orelhas. */}
      <Esfera p={[-H * 0.99, -C * 0.02, 0]} t={[C * 0.1, C * 0.2, C * 0.16]} c={pele} />
      <Esfera p={[H * 0.99, -C * 0.02, 0]} t={[C * 0.1, C * 0.2, C * 0.16]} c={pele} />

      {!semOlhos && (
        <>
          <Olho
            x={-OLHO_X}
            iris={iris}
            pele={pele}
            tipo={rosto.olhos === "piscada" && l === -1 ? "fechado" : rosto.olhos}
          />
          <Olho
            x={OLHO_X}
            iris={iris}
            pele={pele}
            tipo={rosto.olhos === "piscada" && l === 1 ? "fechado" : rosto.olhos}
          />
          <Sobrancelha x={-OLHO_X} tipo={rosto.sobrancelha} cor={sobrancelha} />
          {/* A sobrancelha do lado da assimetria sobe sozinha. */}
          <Sobrancelha
            x={OLHO_X}
            tipo={l === 1 && rosto.sobrancelha === "neutra" ? "erguida" : rosto.sobrancelha}
            cor={sobrancelha}
          />
        </>
      )}

      <Boca tipo={rosto.boca} />
      {rosto.barba && <Barba tipo={rosto.barba.tipo} cor={rosto.barba.cor} />}

      {rosto.blush && (
        <>
          <Disco p={[-C * 0.33, -C * 0.11, Z0]} t={[C * 0.17, C * 0.1, 1]} c="#E8756B" opacidade={0.5} />
          <Disco p={[C * 0.33, -C * 0.11, Z0]} t={[C * 0.17, C * 0.1, 1]} c="#E8756B" opacidade={0.5} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CHAPÉU
// ---------------------------------------------------------------------------

export function ChapeuAvatar({ chapeu }: { chapeu: Chapeu }) {
  const c0 = cor(chapeu.cores, 0, "#2B5CA8");
  const c1 = cor(chapeu.cores, 1, sombra(c0));
  const c2 = cor(chapeu.cores, 2, luz(c0, 0.3));

  switch (chapeu.tipo) {
    case "bone":
    case "boneTras": {
      const tras = chapeu.tipo === "boneTras";
      const z = tras ? -1 : 1;
      return (
        <>
          <BlocoMacio p={[0, H * 0.9, -C * 0.02]} t={[C * 1.1, C * 0.5, C * 1.08]} c={c0} />
          <Bloco p={[0, H * 1.12, -C * 0.02]} t={[C * 0.16, C * 0.12, C * 1.02]} c={c1} />
          <Bloco p={[0, H * 0.68, z * C * 0.86]} t={[C * 0.94, C * 0.07, C * 0.74]} c={c1} r={[z * -0.14, 0, 0]} />
          <Bloco p={[0, H * 0.7, z * C * 0.54]} t={[C * 1.08, C * 0.1, C * 0.1]} c={c2} />
          {!tras && <Disco p={[0, H * 0.94, C * 0.54]} t={[C * 0.2, C * 0.2, 1]} c={c2} />}
          {tras && <Bloco p={[0, H * 0.74, -C * 0.53]} t={[C * 0.3, C * 0.14, C * 0.08]} c={c2} />}
        </>
      );
    }

    case "gorro":
      return (
        <>
          <BlocoMacio p={[0, H * 0.92, 0]} t={[C * 1.12, C * 0.86, C * 1.1]} c={c0} />
          <Bloco p={[0, H * 0.58, 0]} t={[C * 1.16, C * 0.24, C * 1.14]} c={c1} />
          <Bloco p={[0, H * 0.58, C * 0.58]} t={[C * 1.14, C * 0.08, C * 0.06]} c={c2} />
          <Esfera p={[0, H * 1.42, 0]} t={[C * 0.3, C * 0.3, C * 0.3]} c={c2} />
        </>
      );

    case "capaceteAero":
      return (
        <>
          <Esfera p={[0, H * 0.72, -C * 0.04]} t={[C * 1.24, C * 1.16, C * 1.28]} c={c0} />
          <Bloco p={[0, H * 0.78, 0]} t={[C * 0.16, C * 1.1, C * 1.3]} c={c1} />
          <Bloco p={[0, H * 0.3, C * 0.66]} t={[C * 1.1, C * 0.1, C * 0.44]} c={c1} r={[-0.2, 0, 0]} />
          {[-0.3, 0, 0.3].map((x) => (
            <Bloco key={x} p={[C * x, H * 1.2, -C * 0.3]} t={[C * 0.12, C * 0.16, C * 0.4]} c={c2} />
          ))}
        </>
      );

    case "capaceteIntegral":
      return (
        <>
          <Esfera p={[0, H * 0.34, -C * 0.02]} t={[C * 1.3, C * 1.5, C * 1.32]} c={c0} />
          <Bloco p={[0, H * 0.02, C * 0.6]} t={[C * 1.0, C * 0.42, C * 0.24]} c={c1} opacidade={0.55} />
          <Bloco p={[0, H * 0.34, C * 0.66]} t={[C * 1.08, C * 0.1, C * 0.14]} c={c2} />
          <Bloco p={[0, -H * 0.5, C * 0.56]} t={[C * 0.9, C * 0.3, C * 0.3]} c={c1} />
        </>
      );

    case "quepe":
      return (
        <>
          <Bloco p={[0, H * 0.94, -C * 0.02]} t={[C * 1.14, C * 0.44, C * 1.1]} c={c0} />
          <Bloco p={[0, H * 0.7, 0]} t={[C * 1.18, C * 0.12, C * 1.14]} c={c1} />
          <Bloco p={[0, H * 0.64, C * 0.84]} t={[C * 1.0, C * 0.06, C * 0.66]} c={c1} r={[-0.1, 0, 0]} />
          <Bloco p={[0, H * 0.98, C * 0.56]} t={[C * 0.24, C * 0.2, C * 0.06]} c={c2} />
        </>
      );

    case "chapeuBruxa":
      return (
        <>
          <Bloco p={[0, H * 0.7, 0]} t={[C * 2.1, C * 0.09, C * 2.1]} c={c0} r={[0, 0, 0.04]} />
          <Bloco p={[0, H * 0.78, 0]} t={[C * 1.22, C * 0.16, C * 1.2]} c={c1} />
          <Cone p={[0, H * 1.7, -C * 0.06]} t={[C * 1.1, C * 1.7, C * 1.1]} c={c0} r={[-0.1, 0, 0.14]} />
          <Cone p={[C * 0.18, H * 2.5, -C * 0.16]} t={[C * 0.5, C * 0.8, C * 0.5]} c={c0} r={[-0.2, 0, 0.5]} />
          <Esfera p={[C * 0.4, H * 2.86, -C * 0.24]} t={[C * 0.16, C * 0.16, C * 0.16]} c={c2} brilha />
        </>
      );

    case "coroa":
      return (
        <>
          <Cilindro p={[0, H * 0.98, 0]} t={[C * 1.06, C * 0.34, C * 1.06]} c={c0} />
          <Anel p={[0, H * 0.84, 0]} t={[C * 1.14, C * 1.14, C * 1.14]} c={c1} r={[Math.PI / 2, 0, 0]} />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <Cone
                key={i}
                p={[Math.sin(a) * C * 0.46, H * 1.34, Math.cos(a) * C * 0.46]}
                t={[C * 0.2, C * 0.38, C * 0.2]}
                c={c0}
              />
            );
          })}
          <Esfera p={[0, H * 1.14, C * 0.5]} t={[C * 0.16, C * 0.16, C * 0.16]} c={c2} brilha />
          <Esfera p={[-C * 0.4, H * 1.1, C * 0.24]} t={[C * 0.1, C * 0.1, C * 0.1]} c={c2} brilha />
          <Esfera p={[C * 0.4, H * 1.1, C * 0.24]} t={[C * 0.1, C * 0.1, C * 0.1]} c={c2} brilha />
        </>
      );

    case "capuzTigre":
      return (
        <>
          <BlocoMacio p={[0, H * 0.3, -C * 0.06]} t={[C * 1.34, C * 1.5, C * 1.3]} c={c0} />
          <Bloco p={[0, H * 0.34, C * 0.6]} t={[C * 1.0, C * 0.9, C * 0.16]} c={c1} />
          {/* Orelhas de bicho: a única coisa que faz o capuz virar mascote. */}
          <Esfera p={[-C * 0.5, H * 1.16, -C * 0.1]} t={[C * 0.4, C * 0.42, C * 0.24]} c={c0} />
          <Esfera p={[C * 0.5, H * 1.16, -C * 0.1]} t={[C * 0.4, C * 0.42, C * 0.24]} c={c0} />
          <Esfera p={[-C * 0.5, H * 1.16, -C * 0.02]} t={[C * 0.22, C * 0.24, C * 0.2]} c={c2} />
          <Esfera p={[C * 0.5, H * 1.16, -C * 0.02]} t={[C * 0.22, C * 0.24, C * 0.2]} c={c2} />
          {[-0.42, -0.1, 0.24].map((x, i) => (
            <Bloco
              key={x}
              p={[C * x, H * (1.0 - i * 0.1), C * 0.62]}
              t={[C * 0.1, C * 0.3, C * 0.06]}
              c={c1}
              r={[0, 0, 0.2]}
            />
          ))}
        </>
      );

    case "capaceteEspacial":
      return (
        <>
          <Esfera p={[0, H * 0.24, 0]} t={[C * 1.62, C * 1.62, C * 1.62]} c={c0} opacidade={0.32} />
          <Anel p={[0, -H * 0.52, 0]} t={[C * 1.5, C * 1.5, C * 1.5]} c={c1} r={[Math.PI / 2, 0, 0]} />
          <Bloco p={[0, H * 0.5, C * 0.7]} t={[C * 1.1, C * 0.5, C * 0.16]} c={c2} opacidade={0.42} />
          <Cilindro p={[-C * 0.72, H * 0.1, -C * 0.5]} t={[C * 0.14, C * 0.4, C * 0.14]} c={c1} r={[0, 0, 0.4]} />
        </>
      );

    case "toucaNatacao":
      return (
        <>
          <Esfera p={[0, H * 0.5, -C * 0.02]} t={[C * 1.1, C * 1.1, C * 1.1]} c={c0} />
          <Bloco p={[0, H * 0.16, 0]} t={[C * 1.12, C * 0.1, C * 1.1]} c={c1} />
          <Bloco p={[0, H * 0.74, C * 0.42]} t={[C * 0.34, C * 0.1, C * 0.3]} c={c2} r={[0.4, 0, 0]} />
        </>
      );

    case "bandana":
      return (
        <>
          <Bloco p={[0, H * 0.42, 0]} t={[C * 1.1, C * 0.3, C * 1.08]} c={c0} />
          <Bloco p={[0, H * 0.42, C * 0.54]} t={[C * 1.08, C * 0.1, C * 0.06]} c={c1} />
          <Bloco p={[C * 0.56, H * 0.34, -C * 0.44]} t={[C * 0.16, C * 0.5, C * 0.1]} c={c0} r={[0, 0, -0.4]} />
          <Bloco p={[C * 0.68, H * 0.06, -C * 0.5]} t={[C * 0.12, C * 0.36, C * 0.08]} c={c1} r={[0, 0, -0.7]} />
        </>
      );

    case "capuz":
      return (
        <>
          <BlocoMacio p={[0, H * 0.36, -C * 0.14]} t={[C * 1.36, C * 1.5, C * 1.4]} c={c0} />
          <Bloco p={[0, H * 0.2, C * 0.62]} t={[C * 1.16, C * 1.16, C * 0.22]} c={c1} />
          <Bloco p={[0, -H * 0.7, -C * 0.2]} t={[C * 1.3, C * 0.3, C * 1.2]} c={c1} />
          <Bloco p={[0, H * 0.92, C * 0.5]} t={[C * 0.9, C * 0.12, C * 0.2]} c={c2} r={[0.24, 0, 0]} />
        </>
      );

    case "headphone":
      return (
        <>
          <Anel p={[0, H * 0.62, 0]} t={[C * 1.24, C * 1.24, C * 0.5]} c={c0} r={[0, Math.PI / 2, 0]} />
          <Cilindro p={[-H * 1.1, -C * 0.02, 0]} t={[C * 0.3, C * 0.14, C * 0.4]} c={c0} r={[0, 0, Math.PI / 2]} />
          <Cilindro p={[H * 1.1, -C * 0.02, 0]} t={[C * 0.3, C * 0.14, C * 0.4]} c={c0} r={[0, 0, Math.PI / 2]} />
          <Cilindro p={[-H * 1.18, -C * 0.02, 0]} t={[C * 0.2, C * 0.05, C * 0.28]} c={c1} r={[0, 0, Math.PI / 2]} />
          <Cilindro p={[H * 1.18, -C * 0.02, 0]} t={[C * 0.2, C * 0.05, C * 0.28]} c={c1} r={[0, 0, Math.PI / 2]} />
          <Bloco p={[-H * 1.2, -C * 0.02, C * 0.02]} t={[C * 0.03, C * 0.06, C * 0.24]} c={c2} brilha />
        </>
      );

    case "faixaTesta":
    default:
      return (
        <>
          <Bloco p={[0, H * 0.36, 0]} t={[C * 1.12, C * 0.18, C * 1.1]} c={c0} />
          <Bloco p={[0, H * 0.36, C * 0.55]} t={[C * 1.1, C * 0.06, C * 0.06]} c={c1} />
          <Disco p={[0, H * 0.36, C * 0.57]} t={[C * 0.18, C * 0.18, 1]} c={c2} />
        </>
      );
  }
}

// ---------------------------------------------------------------------------
// ACESSÓRIO DE ROSTO
// ---------------------------------------------------------------------------

export function FaceAvatar({ face }: { face: Face }) {
  const c0 = cor(face.cores, 0, "#15161A");
  const c1 = cor(face.cores, 1, "#8A8F98");

  switch (face.tipo) {
    case "oculosEscuros":
    case "oculosEspelhados": {
      const lente = face.tipo === "oculosEspelhados" ? c1 : c0;
      return (
        <>
          <Bloco p={[-OLHO_X, OLHO_Y, H + 0.02]} t={[C * 0.32, C * 0.22, C * 0.06]} c={lente} brilha={face.tipo === "oculosEspelhados"} />
          <Bloco p={[OLHO_X, OLHO_Y, H + 0.02]} t={[C * 0.32, C * 0.22, C * 0.06]} c={lente} brilha={face.tipo === "oculosEspelhados"} />
          <Bloco p={[0, OLHO_Y + C * 0.03, H + 0.02]} t={[C * 0.12, C * 0.05, C * 0.05]} c={c0} />
          <Bloco p={[0, OLHO_Y + C * 0.11, H + 0.015]} t={[C * 0.78, C * 0.04, C * 0.05]} c={c0} />
          <Bloco p={[-H * 0.96, OLHO_Y + C * 0.06, C * 0.16]} t={[C * 0.06, C * 0.04, C * 0.5]} c={c0} />
          <Bloco p={[H * 0.96, OLHO_Y + C * 0.06, C * 0.16]} t={[C * 0.06, C * 0.04, C * 0.5]} c={c0} />
        </>
      );
    }

    case "oculosRedondos":
      return (
        <>
          <Anel p={[-OLHO_X, OLHO_Y, H + 0.01]} t={[C * 0.34, C * 0.34, C * 0.1]} c={c0} />
          <Anel p={[OLHO_X, OLHO_Y, H + 0.01]} t={[C * 0.34, C * 0.34, C * 0.1]} c={c0} />
          <Disco p={[-OLHO_X, OLHO_Y, H + 0.008]} t={[C * 0.3, C * 0.3, 1]} c={c1} opacidade={0.22} />
          <Disco p={[OLHO_X, OLHO_Y, H + 0.008]} t={[C * 0.3, C * 0.3, 1]} c={c1} opacidade={0.22} />
          <Bloco p={[0, OLHO_Y, H + 0.01]} t={[C * 0.1, C * 0.025, C * 0.03]} c={c0} />
        </>
      );

    case "oculosNatacao":
      return (
        <>
          <Anel p={[-OLHO_X, OLHO_Y, H + 0.012]} t={[C * 0.34, C * 0.32, C * 0.16]} c={c0} />
          <Anel p={[OLHO_X, OLHO_Y, H + 0.012]} t={[C * 0.34, C * 0.32, C * 0.16]} c={c0} />
          <Disco p={[-OLHO_X, OLHO_Y, H + 0.016]} t={[C * 0.28, C * 0.26, 1]} c={c1} opacidade={0.55} brilha />
          <Disco p={[OLHO_X, OLHO_Y, H + 0.016]} t={[C * 0.28, C * 0.26, 1]} c={c1} opacidade={0.55} brilha />
          <Bloco p={[0, OLHO_Y, H + 0.01]} t={[C * 0.14, C * 0.05, C * 0.04]} c={c0} />
          <Bloco p={[0, OLHO_Y, -C * 0.02]} t={[C * 1.06, C * 0.06, C * 1.04]} c={c0} />
        </>
      );

    case "pinturaFacial":
      return (
        <>
          <Bloco p={[-C * 0.24, C * 0.06, Z0]} t={[C * 0.5, C * 0.7, 0.012]} c={c0} r={[0, 0, 0.2]} opacidade={0.85} />
          <Bloco p={[C * 0.3, -C * 0.1, Z0]} t={[C * 0.4, C * 0.5, 0.012]} c={c1} r={[0, 0, -0.24]} opacidade={0.85} />
          <Bloco p={[0, -C * 0.36, Z0]} t={[C * 0.7, C * 0.08, 0.012]} c={c0} opacidade={0.85} />
        </>
      );

    case "mascaraShinobi":
      return (
        <>
          <Bloco p={[0, -C * 0.24, C * 0.06]} t={[C * 1.04, C * 0.5, C * 1.02]} c={c0} />
          <Bloco p={[0, -C * 0.1, C * 0.5]} t={[C * 0.9, C * 0.08, C * 0.1]} c={c1} />
          <Bloco p={[0, -C * 0.44, -C * 0.5]} t={[C * 0.3, C * 0.5, C * 0.1]} c={c0} r={[0, 0, 0.2]} />
        </>
      );

    case "visorDourado":
    default:
      return (
        <>
          <Bloco p={[0, OLHO_Y + C * 0.02, H + 0.02]} t={[C * 0.92, C * 0.26, C * 0.07]} c={c0} brilha opacidade={0.7} />
          <Bloco p={[0, OLHO_Y + C * 0.16, H + 0.02]} t={[C * 0.96, C * 0.05, C * 0.07]} c={c1} />
          <Bloco p={[0, OLHO_Y - C * 0.12, H + 0.02]} t={[C * 0.96, C * 0.04, C * 0.07]} c={c1} />
        </>
      );
  }
}

// ---------------------------------------------------------------------------
// CABEÇA MONTADA
//
// A ordem importa: pescoço → crânio → cabelo → rosto → acessório → chapéu. E as
// duas flags de esconder são resolvidas AQUI, uma vez, em vez de cada peça
// adivinhar se está coberta.
// ---------------------------------------------------------------------------

export function CabecaAvatar({
  pele,
  cabelo,
  rosto,
  chapeu,
  face,
}: {
  pele: string;
  cabelo: Cabelo;
  rosto: Rosto;
  chapeu?: Chapeu;
  face?: Face;
}) {
  const semOlhos = Boolean(chapeu?.escondeOlhos || face?.escondeOlhos);
  const semCabelo = Boolean(chapeu?.escondeCabelo);

  return (
    <group>
      <BlocoMacio p={[0, 0, 0]} t={[C, C, C * 0.92]} c={pele} />
      {/* Sombra do queixo: a única oclusão ambiente que existe no modelo. */}
      <Bloco p={[0, -H * 0.9, C * 0.1]} t={[C * 0.7, C * 0.06, C * 0.6]} c={sombra(pele, 0.88)} />

      {!semCabelo && <CabeloAvatar cabelo={cabelo} achatado={Boolean(chapeu)} />}
      <RostoAvatar rosto={rosto} pele={pele} cabeloCor={cabelo.cores[0]} semOlhos={semOlhos} />
      {face && <FaceAvatar face={face} />}
      {chapeu && <ChapeuAvatar chapeu={chapeu} />}
    </group>
  );
}
