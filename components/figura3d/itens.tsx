// Geometria de cada acessório.
//
// Uma função por `forma` do catálogo, registrada em `FORMAS` no fim do arquivo.
// O catálogo (`lib/figura/catalogo.ts`) é TypeScript puro e importável pelo
// servidor; a geometria mora aqui, do lado do cliente. O elo entre os dois é a
// string `forma` — e o teste `catalogo.test.ts` garante que nenhuma fique órfã.
//
// Toda posição sai de `Medidas`, nunca de número mágico: é o que faz o boné
// continuar na cabeça quando o usuário troca de "magro" para "forte".
//
// Os veículos ficam ATRÁS do personagem, no chão. Não existe pose de dirigir —
// o boneco é rígido, e uma pose sentada exigiria articular o corpo inteiro para
// um item que a maioria vê de longe.

"use client";

import { Instance, Instances } from "@react-three/drei";
import { useMemo } from "react";

import { Anel, Bloco, Cilindro, Cone, Esfera } from "./blocos";
import { ESFERA, type Medidas, materialTransparente } from "./primitivas";

export type PropsItem = { c: string[]; m: Medidas };
export type Forma = (p: PropsItem) => JSX.Element | null;

const T = Math.PI / 2;
/** Segunda cor com fallback — item de uma cor só não pode quebrar o detalhe. */
const c2 = (c: string[]) => c[1] ?? c[0];

// ============================================================== CHAPÉUS
const bone: Forma = ({ c, m }) => (
  <group position={[0, m.yTopo, 0]}>
    <Bloco p={[0, 0.08, 0]} t={[m.cabeca * 1.04, 0.16, m.cabeca * 1.04]} c={c[0]} />
    <Bloco p={[0, 0.02, m.cabeca * 0.62]} t={[m.cabeca * 0.9, 0.05, m.cabeca * 0.62]} c={c2(c)} />
  </group>
);

const gorro: Forma = ({ c, m }) => (
  <group position={[0, m.yTopo, 0]}>
    <Bloco p={[0, 0.11, 0]} t={[m.cabeca * 1.05, 0.22, m.cabeca * 1.05]} c={c[0]} />
    <Bloco p={[0, -0.06, 0]} t={[m.cabeca * 1.1, 0.12, m.cabeca * 1.1]} c={c[0]} />
    <Esfera p={[0, 0.28, 0]} t={[0.14, 0.14, 0.14]} c={c[0]} />
  </group>
);

const bucket: Forma = ({ c, m }) => (
  <group position={[0, m.yTopo, 0]}>
    <Cilindro p={[0, 0.1, 0]} t={[m.cabeca * 1.02, 0.2, m.cabeca * 1.02]} c={c[0]} />
    <Cilindro p={[0, 0.01, 0]} t={[m.cabeca * 1.7, 0.05, m.cabeca * 1.7]} c={c2(c)} />
  </group>
);

const capacete: Forma = ({ c, m }) => (
  <group position={[0, m.yCabeca, 0]}>
    <Esfera p={[0, 0.12, 0]} t={[m.cabeca * 1.12, m.cabeca * 1.15, m.cabeca * 1.12]} c={c[0]} />
    <Bloco p={[0, 0.02, m.zRosto * 0.9]} t={[m.cabeca * 1.05, 0.14, 0.1]} c={c2(c)} />
    <Bloco p={[0, m.cabeca * 0.62, 0]} t={[0.07, 0.12, m.cabeca * 1.1]} c={c2(c)} />
  </group>
);

const tubarao: Forma = ({ c, m }) => {
  const s = m.cabeca * 1.35;
  return (
    <group position={[0, m.yCabeca + 0.06, 0]}>
      <Bloco p={[0, 0.05, -0.04]} t={[s, s * 0.95, s * 1.25]} c={c[0]} />
      <Cone p={[0, s * 0.72, -0.05]} t={[0.22, 0.42, 0.1]} c={c[0]} />
      {/* focinho e dentes: o item é a piada, precisa ler de longe */}
      <Bloco p={[0, -0.12, s * 0.66]} t={[s * 0.8, 0.3, 0.24]} c={c2(c)} />
      {[-0.22, -0.07, 0.07, 0.22].map((x) => (
        <Cone key={x} p={[x, -0.24, s * 0.7]} t={[0.09, 0.16, 0.09]} r={[Math.PI, 0, 0]} c={c2(c)} />
      ))}
    </group>
  );
};

const rolo: Forma = ({ c, m }) => (
  <group position={[0, m.yTopo + 0.22, 0]}>
    <Cilindro p={[0, 0, 0]} t={[0.42, 0.46, 0.42]} c={c[0]} />
    <Cilindro p={[0, 0.01, 0]} t={[0.16, 0.5, 0.16]} c={c2(c)} />
  </group>
);

const coroa: Forma = ({ c, m }) => (
  <group position={[0, m.yTopo + 0.02, 0]}>
    <Cilindro p={[0, 0.09, 0]} t={[m.cabeca * 0.98, 0.18, m.cabeca * 0.98]} c={c[0]} />
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2;
      const raio = m.cabeca * 0.44;
      return (
        <Cone
          key={i}
          p={[Math.sin(a) * raio, 0.28, Math.cos(a) * raio]}
          t={[0.13, 0.24, 0.13]}
          c={c[0]}
        />
      );
    })}
    <Esfera p={[0, 0.2, m.cabeca * 0.5]} t={[0.1, 0.1, 0.1]} c={c2(c)} brilha />
  </group>
);

// ================================================================ ROSTO
const oculos: Forma = ({ c, m }) => (
  <group position={[0, m.yCabeca + 0.08, m.zRosto + 0.01]}>
    <Bloco p={[0, 0, 0]} t={[m.cabeca * 0.92, 0.17, 0.06]} c={c[0]} />
    <Bloco p={[0, 0.02, -0.02]} t={[m.cabeca * 1.02, 0.05, 0.04]} c={c2(c)} />
  </group>
);

const oculosRedondos: Forma = ({ c, m }) => (
  <group position={[0, m.yCabeca + 0.08, m.zRosto + 0.02]}>
    {[-0.17, 0.17].map((x) => (
      <Anel key={x} p={[x, 0, 0]} t={[0.3, 0.3, 0.3]} c={c[0]} />
    ))}
    <Bloco p={[0, 0, 0]} t={[0.14, 0.03, 0.03]} c={c[0]} />
    {[-0.17, 0.17].map((x) => (
      <Bloco key={x} p={[x, 0, -0.02]} t={[0.24, 0.24, 0.02]} c={c2(c)} opacidade={0.45} />
    ))}
  </group>
);

const mascara: Forma = ({ c, m }) => (
  <Bloco
    p={[0, m.yCabeca - 0.14, m.zRosto + 0.01]}
    t={[m.cabeca * 0.94, 0.3, 0.08]}
    c={c[0]}
  />
);

const tapaOlho: Forma = ({ c, m }) => (
  <group position={[0, m.yCabeca + 0.09, 0]}>
    <Bloco p={[-0.16, 0, m.zRosto + 0.02]} t={[0.22, 0.2, 0.05]} c={c[0]} />
    <Bloco p={[0, 0.09, 0]} t={[m.cabeca * 1.04, 0.04, m.cabeca * 1.04]} c={c[0]} />
  </group>
);

const viseira: Forma = ({ c, m }) => (
  <group position={[0, m.yCabeca + 0.08, m.zRosto + 0.02]}>
    <Bloco p={[0, 0, 0]} t={[m.cabeca * 1.0, 0.13, 0.05]} c={c[0]} brilha />
    <Bloco p={[0, 0, -0.03]} t={[m.cabeca * 1.06, 0.2, 0.04]} c={c2(c)} />
  </group>
);

// ================================================================ TORSO
/** A roupa é uma casca por cima do tronco — nunca substitui o corpo. */
const casca = (m: Medidas, e = 0.05) =>
  [m.torsoL + e, m.torsoA + 0.02, m.torsoP + e] as [number, number, number];

const mangas = (m: Medidas, c: string, comprida: boolean) =>
  [-1, 1].map((s) => (
    <Bloco
      key={s}
      p={[s * (m.torsoL / 2 + m.braco / 2), m.yTorso + (comprida ? -0.06 : 0.26), 0]}
      t={[m.braco + 0.05, comprida ? m.bracoA * 0.92 : 0.34, m.braco + 0.05]}
      c={c}
    />
  ));

const camiseta: Forma = ({ c, m }) => (
  <group>
    <Bloco p={[0, m.yTorso, 0]} t={casca(m)} c={c[0]} />
    {mangas(m, c[0], false)}
    {c[1] && (
      <>
        <Bloco p={[0, m.yTorso + 0.18, 0]} t={casca(m, 0.07)} c={c[1]} />
        <Bloco p={[0, m.yTorso - 0.18, 0]} t={casca(m, 0.07)} c={c[1]} />
      </>
    )}
  </group>
);

const moletom: Forma = ({ c, m }) => (
  <group>
    <Bloco p={[0, m.yTorso, 0]} t={casca(m, 0.1)} c={c[0]} />
    {mangas(m, c[0], true)}
    {/* capuz caído nas costas — é o que distingue moletom de camiseta de longe */}
    <Bloco
      p={[0, m.yTorso + m.torsoA / 2 - 0.02, m.zCostas - 0.12]}
      t={[m.torsoL * 0.8, 0.3, 0.22]}
      c={c2(c)}
    />
    <Bloco p={[0, m.yTorso - m.torsoA / 2, 0]} t={casca(m, 0.12)} c={c2(c)} />
  </group>
);

const jaqueta: Forma = ({ c, m }) => (
  <group>
    <Bloco p={[0, m.yTorso, 0]} t={casca(m, 0.11)} c={c[0]} />
    {mangas(m, c[0], true)}
    <Bloco p={[0, m.yTorso, m.torsoP / 2 + 0.05]} t={[0.06, m.torsoA, 0.04]} c={c2(c)} />
    <Bloco
      p={[0, m.yTorso + m.torsoA / 2 - 0.04, m.torsoP / 2 + 0.03]}
      t={[m.torsoL * 0.7, 0.12, 0.09]}
      c={c2(c)}
    />
  </group>
);

const terno: Forma = ({ c, m }) => (
  <group>
    <Bloco p={[0, m.yTorso, 0]} t={casca(m, 0.11)} c={c[0]} />
    {mangas(m, c[0], true)}
    <Bloco p={[0, m.yTorso + 0.1, m.torsoP / 2 + 0.04]} t={[0.2, m.torsoA * 0.6, 0.04]} c={c2(c)} />
    <Bloco p={[0, m.yTorso + 0.08, m.torsoP / 2 + 0.07]} t={[0.09, 0.36, 0.03]} c={c[0]} />
  </group>
);

const uniforme: Forma = ({ c, m }) => (
  <group>
    <Bloco p={[0, m.yTorso, 0]} t={casca(m)} c={c[0]} />
    {mangas(m, c[0], false)}
    <Bloco p={[0, m.yTorso, 0]} t={[m.torsoL * 0.3, m.torsoA + 0.03, m.torsoP + 0.07]} c={c2(c)} />
    <Bloco
      p={[0, m.yTorso + m.torsoA / 2 - 0.03, 0]}
      t={[m.torsoL + 0.08, 0.07, m.torsoP + 0.08]}
      c={c2(c)}
    />
  </group>
);

// =============================================================== PERNAS
const calca = (m: Medidas, c: string, altura: number) =>
  [-1, 1].map((s) => (
    <Bloco
      key={s}
      p={[s * (m.perna / 2 + 0.015), m.pernaA - altura / 2, 0]}
      t={[m.perna + 0.05, altura, m.perna + 0.05]}
      c={c}
    />
  ));

const jeans: Forma = ({ c, m }) => <group>{calca(m, c[0], m.pernaA * 0.98)}</group>;

const baggy: Forma = ({ c, m }) => (
  <group>
    {[-1, 1].map((s) => (
      <Bloco
        key={s}
        p={[s * (m.perna / 2 + 0.03), m.pernaA * 0.51, 0]}
        t={[m.perna + 0.16, m.pernaA * 0.98, m.perna + 0.14]}
        c={c[0]}
      />
    ))}
  </group>
);

const shorts: Forma = ({ c, m }) => <group>{calca(m, c[0], m.pernaA * 0.5)}</group>;

// ================================================================== PÉS
const calcado = (altura: number, comprimento: number, sola: boolean): Forma =>
  function Calcado({ c, m }) {
    return (
      <group>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (m.perna / 2 + 0.015), 0, 0]}>
            <Bloco
              p={[0, altura / 2, comprimento / 2 - m.perna / 2]}
              t={[m.perna + 0.07, altura, comprimento]}
              c={c[0]}
            />
            {sola && (
              <Bloco
                p={[0, 0.03, comprimento / 2 - m.perna / 2]}
                t={[m.perna + 0.09, 0.06, comprimento + 0.02]}
                c={c2(c)}
              />
            )}
          </group>
        ))}
      </group>
    );
  };

const tenis = calcado(0.2, 0.44, true);
const bota = calcado(0.42, 0.4, true);
const chuteira: Forma = (p) => (
  <group>
    {calcado(0.18, 0.44, true)(p)}
    {[-1, 1].map((s) =>
      [0.05, 0.2, 0.35].map((z) => (
        <Bloco
          key={`${s}-${z}`}
          p={[s * (p.m.perna / 2 + 0.015), 0.01, z]}
          t={[0.16, 0.04, 0.06]}
          c={c2(p.c)}
        />
      )),
    )}
  </group>
);
const chinelo: Forma = ({ c, m }) => (
  <group>
    {[-1, 1].map((s) => (
      <group key={s} position={[s * (m.perna / 2 + 0.015), 0, 0]}>
        <Bloco p={[0, 0.04, 0.08]} t={[m.perna + 0.07, 0.07, 0.42]} c={c[0]} />
        <Bloco p={[0, 0.11, 0.16]} t={[m.perna + 0.05, 0.05, 0.06]} c={c2(c)} />
      </group>
    ))}
  </group>
);

// ========================================================== MÃO DIREITA
/** Tudo que vai na mão nasce na origem e é posicionado por este wrapper. */
const naMao = (lado: -1 | 1, conteudo: (p: PropsItem) => JSX.Element): Forma =>
  function NaMao(p) {
    return (
      <group position={[lado === -1 ? p.m.xMao : -p.m.xMao, p.m.yMao, 0.05]}>{conteudo(p)}</group>
    );
  };

const bola = naMao(-1, ({ c }) => (
  <group>
    <Esfera p={[0, -0.12, 0.16]} t={[0.36, 0.36, 0.36]} c={c[0]} />
    <Esfera p={[0, -0.12, 0.16]} t={[0.38, 0.14, 0.14]} c={c[1] ?? c[0]} />
  </group>
));

const microfone = naMao(-1, ({ c }) => (
  <group position={[0, -0.05, 0.1]}>
    <Cilindro p={[0, 0, 0]} t={[0.07, 0.3, 0.07]} c={c[0]} />
    <Esfera p={[0, 0.2, 0]} t={[0.14, 0.14, 0.14]} c={c[1] ?? c[0]} />
  </group>
));

const taco = naMao(-1, ({ c }) => (
  <group position={[0, 0.1, 0.1]} rotation={[0.5, 0, 0]}>
    <Cilindro p={[0, 0.3, 0]} t={[0.13, 0.6, 0.13]} c={c[0]} />
    <Cilindro p={[0, -0.12, 0]} t={[0.07, 0.28, 0.07]} c={c[0]} />
  </group>
));

const skate = naMao(-1, ({ c }) => (
  <group position={[0.12, 0.15, 0]} rotation={[0, 0, 0.25]}>
    <Bloco p={[0, 0, 0]} t={[0.24, 1.1, 0.06]} c={c[0]} />
    {[-0.36, 0.36].map((y) => (
      <Bloco key={y} p={[0, y, -0.09]} t={[0.28, 0.08, 0.1]} c={c[1] ?? c[0]} />
    ))}
  </group>
));

const espada = naMao(-1, ({ c }) => (
  <group position={[0, 0.2, 0.12]} rotation={[0.15, 0, 0]}>
    <Bloco p={[0, 0.62, 0]} t={[0.1, 1.05, 0.03]} c={c[0]} />
    <Cone p={[0, 1.22, 0]} t={[0.1, 0.16, 0.03]} c={c[0]} />
    <Bloco p={[0, 0.06, 0]} t={[0.34, 0.07, 0.08]} c={c[1] ?? c[0]} />
    <Cilindro p={[0, -0.11, 0]} t={[0.07, 0.28, 0.07]} c={c[1] ?? c[0]} />
  </group>
));

const blaster = naMao(-1, ({ c }) => (
  <group position={[0, 0.02, 0.16]}>
    <Bloco p={[0, 0.08, 0.1]} t={[0.1, 0.16, 0.5]} c={c[0]} />
    <Bloco p={[0, -0.12, -0.02]} t={[0.08, 0.26, 0.12]} c={c[0]} />
    <Cilindro p={[0, 0.08, 0.4]} t={[0.09, 0.14, 0.09]} r={[T, 0, 0]} c={c[1] ?? c[0]} brilha />
  </group>
));

const trofeu = naMao(-1, ({ c }) => (
  <group position={[0, 0.05, 0.14]}>
    <Cilindro p={[0, 0.28, 0]} t={[0.26, 0.26, 0.26]} c={c[0]} />
    {[-1, 1].map((s) => (
      <Anel key={s} p={[s * 0.17, 0.3, 0]} t={[0.2, 0.2, 0.2]} r={[0, T, 0]} c={c[0]} />
    ))}
    <Cilindro p={[0, 0.09, 0]} t={[0.06, 0.14, 0.06]} c={c[0]} />
    <Bloco p={[0, 0.01, 0]} t={[0.24, 0.08, 0.24]} c={c[1] ?? c[0]} />
  </group>
));

// ========================================================= MÃO ESQUERDA
const celular = naMao(1, ({ c }) => (
  <group position={[0, -0.02, 0.14]} rotation={[0.4, 0, 0]}>
    <Bloco p={[0, 0, 0]} t={[0.18, 0.32, 0.03]} c={c[0]} />
    <Bloco p={[0, 0, 0.02]} t={[0.14, 0.26, 0.01]} c={c[1] ?? c[0]} brilha />
  </group>
));

const buque = naMao(1, ({ c }) => (
  <group position={[0, 0.06, 0.14]}>
    <Cilindro p={[0, 0, 0]} t={[0.06, 0.3, 0.06]} c={c[1] ?? c[0]} />
    {[-0.09, 0, 0.09].map((x, i) => (
      <Esfera key={x} p={[x, 0.24 + (i === 1 ? 0.06 : 0), 0]} t={[0.13, 0.13, 0.13]} c={c[0]} />
    ))}
  </group>
));

const lanterna = naMao(1, ({ c }) => (
  <group position={[0, -0.04, 0.14]}>
    <Cilindro p={[0, 0, 0]} t={[0.1, 0.3, 0.1]} c={c[0]} />
    <Cone p={[0, 0.2, 0]} t={[0.18, 0.14, 0.18]} c={c[1] ?? c[0]} brilha />
  </group>
));

const escudo = naMao(1, ({ c, m }) => (
  <group position={[0.02, 0.12, 0.16]} rotation={[0, -0.25, 0]}>
    <Bloco p={[0, 0, 0]} t={[0.1, m.torsoA * 0.85, 0.62]} c={c[0]} />
    <Bloco p={[0.04, 0, 0]} t={[0.04, m.torsoA * 0.5, 0.3]} c={c[1] ?? c[0]} />
  </group>
));

// =============================================================== COSTAS
const mochila: Forma = ({ c, m }) => (
  <group position={[0, m.yTorso, m.zCostas - 0.16]}>
    <Bloco p={[0, 0, 0]} t={[m.torsoL * 0.78, m.torsoA * 0.85, 0.3]} c={c[0]} />
    <Bloco p={[0, -0.12, 0.02]} t={[m.torsoL * 0.6, 0.16, 0.34]} c={c2(c)} />
    {[-1, 1].map((s) => (
      <Bloco
        key={s}
        p={[s * m.torsoL * 0.3, 0.06, m.torsoP + 0.14]}
        t={[0.09, m.torsoA * 0.9, 0.05]}
        c={c2(c)}
      />
    ))}
  </group>
);

const capa: Forma = ({ c, m }) => (
  <group position={[0, 0, m.zCostas - 0.06]}>
    <Bloco
      p={[0, m.yTorso - 0.18, 0]}
      t={[m.torsoL * 1.12, m.torsoA + 0.9, 0.05]}
      c={c[0]}
    />
    <Bloco
      p={[0, m.yTorso + m.torsoA / 2, 0.05]}
      t={[m.torsoL * 1.1, 0.12, 0.14]}
      c={c2(c)}
    />
  </group>
);

const prancha: Forma = ({ c, m }) => (
  <group position={[0, m.yTorso, m.zCostas - 0.14]} rotation={[0, 0, 0.35]}>
    <Bloco p={[0, 0, 0]} t={[0.42, 1.9, 0.09]} c={c[0]} />
    <Bloco p={[0, 0, 0.05]} t={[0.09, 1.7, 0.02]} c={c2(c)} />
  </group>
);

const asas: Forma = ({ c, m }) => (
  <group position={[0, m.yTorso + 0.12, m.zCostas - 0.06]}>
    {[-1, 1].map((s) => (
      <group key={s} rotation={[0, 0, s * -0.45]}>
        <Bloco p={[s * 0.44, 0.1, 0]} t={[0.8, 0.72, 0.07]} c={c[0]} />
        <Bloco p={[s * 0.82, -0.18, 0]} t={[0.5, 0.5, 0.06]} c={c[0]} />
      </group>
    ))}
  </group>
);

// ================================================================= AURA
/**
 * 40 partículas num anel. `Instances` do drei manda as 40 numa chamada de
 * desenho só — 40 malhas soltas seriam 40, e a aura sozinha custaria mais que
 * o resto do personagem inteiro.
 *
 * Estática de propósito: o canvas roda em `frameloop="demand"`, então animar
 * exigiria acordar o loop 60x por segundo e comer bateria enquanto o usuário
 * está parado escolhendo tênis.
 */
const Aura: Forma = ({ c, m }) => {
  const pontos = useMemo(() => {
    const out: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 * 3;
      const t = i / 40;
      const raio = 0.95 + Math.sin(t * Math.PI * 4) * 0.16;
      out.push([Math.sin(a) * raio, t * m.yTopo * 1.05, Math.cos(a) * raio, 0.05 + (1 - t) * 0.1]);
    }
    return out;
  }, [m.yTopo]);

  return (
    <Instances geometry={ESFERA} material={materialTransparente(c[0], 0.75)} limit={40}>
      {pontos.map(([x, y, z, s], i) => (
        <Instance key={i} position={[x, y, z]} scale={s} />
      ))}
    </Instances>
  );
};

// ============================================================== VEÍCULOS
const roda = (x: number, z: number, r = 0.3) => (
  <Anel key={`${x}-${z}`} p={[x, r, z]} t={[r * 2, r * 2, r * 2]} r={[0, T, 0]} c="#17181B" />
);

const carro: Forma = ({ c }) => (
  <group position={[0, 0, -1.5]}>
    <Bloco p={[0, 0.42, 0]} t={[1.9, 0.4, 3.4]} c={c[0]} />
    <Bloco p={[0, 0.78, -0.25]} t={[1.6, 0.42, 1.5]} c={c[0]} />
    <Bloco p={[0, 0.78, -0.25]} t={[1.64, 0.24, 1.3]} c="#2A3138" opacidade={0.75} />
    <Bloco p={[0, 0.22, 0]} t={[2.0, 0.14, 3.2]} c={c[1] ?? c[0]} />
    {[
      [-0.85, 1.15],
      [0.85, 1.15],
      [-0.85, -1.15],
      [0.85, -1.15],
    ].map(([x, z]) => roda(x, z))}
  </group>
);

const suv: Forma = ({ c }) => (
  <group position={[0, 0, -1.6]}>
    <Bloco p={[0, 0.62, 0]} t={[2.05, 0.7, 3.6]} c={c[0]} />
    <Bloco p={[0, 1.15, -0.1]} t={[1.85, 0.5, 2.4]} c={c[0]} />
    <Bloco p={[0, 1.15, -0.1]} t={[1.89, 0.3, 2.2]} c="#2A3138" opacidade={0.75} />
    <Bloco p={[0, 0.3, 0]} t={[2.15, 0.16, 3.5]} c={c[1] ?? c[0]} />
    {[
      [-0.95, 1.2],
      [0.95, 1.2],
      [-0.95, -1.2],
      [0.95, -1.2],
    ].map(([x, z]) => roda(x, z, 0.38))}
  </group>
);

const moto: Forma = ({ c }) => (
  <group position={[0, 0, -1.3]}>
    <Bloco p={[0, 0.62, 0]} t={[0.34, 0.34, 1.3]} c={c[0]} />
    <Bloco p={[0, 0.85, -0.15]} t={[0.4, 0.16, 0.6]} c={c[1] ?? c[0]} />
    <Bloco p={[0, 0.95, 0.6]} t={[0.7, 0.08, 0.08]} c="#3A3D45" />
    <Bloco p={[0, 0.78, 0.62]} t={[0.34, 0.3, 0.2]} c={c[1] ?? c[0]} />
    {roda(0, 0.95, 0.42)}
    {roda(0, -0.95, 0.42)}
  </group>
);

const bicicleta: Forma = ({ c }) => (
  <group position={[0, 0, -1.2]}>
    <Bloco p={[0, 0.62, 0]} t={[0.08, 0.08, 1.2]} c={c[0]} />
    <Bloco p={[0, 0.5, 0.3]} t={[0.07, 0.5, 0.07]} r={[0.4, 0, 0]} c={c[0]} />
    <Bloco p={[0, 0.5, -0.35]} t={[0.07, 0.55, 0.07]} r={[-0.3, 0, 0]} c={c[0]} />
    <Bloco p={[0, 0.9, -0.42]} t={[0.28, 0.1, 0.36]} c={c[1] ?? c[0]} />
    <Bloco p={[0, 0.95, 0.5]} t={[0.6, 0.07, 0.07]} c={c[1] ?? c[0]} />
    {roda(0, 0.78, 0.42)}
    {roda(0, -0.78, 0.42)}
  </group>
);

export const FORMAS: Record<string, Forma> = {
  bone,
  gorro,
  bucket,
  capacete,
  tubarao,
  rolo,
  coroa,
  oculos,
  oculosRedondos,
  mascara,
  tapaOlho,
  viseira,
  camiseta,
  moletom,
  jaqueta,
  terno,
  uniforme,
  jeans,
  baggy,
  shorts,
  tenis,
  bota,
  chuteira,
  chinelo,
  bola,
  microfone,
  taco,
  skate,
  espada,
  blaster,
  trofeu,
  celular,
  buque,
  lanterna,
  escudo,
  mochila,
  capa,
  prancha,
  asas,
  aura: Aura,
  carro,
  suv,
  moto,
  bicicleta,
};
