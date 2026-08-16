// O boneco: corpo, rosto, cabelo — e os acessórios equipados por cima.
//
// O corpo é grátis (faz parte do desbloqueio) e o acessório é comprado, mas
// aqui os dois são a mesma coisa: geometria posicionada por `Medidas`. A
// separação entre "personagem" e "loja" é da UI, não do modelo.
//
// Nada anima. O canvas roda em `frameloop="demand"` e só redesenha quando o
// usuário gira ou troca uma peça — parado, o custo é zero.

"use client";

import type { FiguraV2 } from "@/lib/figura/tipos";
import { CABELOS, PELES } from "@/lib/figura/paletas";
import { POR_ID } from "@/lib/figura/catalogo";

import { Bloco, Cilindro, Cone, Esfera } from "./blocos";
import { FORMAS } from "./itens";
import { medidasDe, type Medidas } from "./primitivas";

const BRANCO = "#F7F8FA";
const ESCURO = "#14151A";

/** Tom de pele um pouco mais escuro, para lábios e sombra. */
function escurecer(hex: string, f = 0.78): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// -------------------------------------------------------------- CABELO
function Cabelo({ estilo, cor, m }: { estilo: string; cor: string; m: Medidas }) {
  const l = m.cabeca;
  const topo = m.yTopo;
  const casca = <Bloco p={[0, topo - 0.07, 0]} t={[l * 1.04, 0.16, l * 1.04]} c={cor} />;

  switch (estilo) {
    case "careca":
      return null;
    case "curto":
      return (
        <group>
          {casca}
          <Bloco p={[0, topo - 0.2, -l * 0.46]} t={[l * 1.04, 0.24, 0.1]} c={cor} />
        </group>
      );
    case "espetado":
      return (
        <group>
          {casca}
          {[-0.22, 0, 0.22].map((x) =>
            [-0.16, 0.14].map((z) => (
              <Cone key={`${x}-${z}`} p={[x, topo + 0.14, z]} t={[0.14, 0.28, 0.14]} c={cor} />
            )),
          )}
        </group>
      );
    case "moicano":
      return (
        <group>
          <Bloco p={[0, topo + 0.1, 0]} t={[0.17, 0.34, l * 1.02]} c={cor} />
          <Bloco p={[0, topo - 0.08, 0]} t={[l * 1.04, 0.1, l * 1.04]} c={escurecer(cor, 0.6)} />
        </group>
      );
    case "afro":
      return <Esfera p={[0, topo - 0.02, -0.02]} t={[l * 1.5, l * 1.35, l * 1.5]} c={cor} />;
    case "longo":
      return (
        <group>
          {casca}
          <Bloco p={[0, m.yCabeca - 0.28, -l * 0.5]} t={[l * 1.02, l * 1.2, 0.14]} c={cor} />
          {[-1, 1].map((s) => (
            <Bloco key={s} p={[s * l * 0.5, m.yCabeca - 0.1, 0]} t={[0.12, l * 0.9, l]} c={cor} />
          ))}
        </group>
      );
    case "rabo":
      return (
        <group>
          {casca}
          <Cilindro p={[0, m.yCabeca - 0.12, -l * 0.66]} t={[0.2, 0.7, 0.2]} c={cor} />
        </group>
      );
    case "franja":
      return (
        <group>
          {casca}
          <Bloco p={[0, topo - 0.24, l * 0.48]} t={[l * 1.04, 0.26, 0.1]} c={cor} />
        </group>
      );
    case "coque":
      return (
        <group>
          {casca}
          <Esfera p={[0, topo + 0.16, -0.14]} t={[0.32, 0.3, 0.32]} c={cor} />
        </group>
      );
    case "dread":
      return (
        <group>
          {casca}
          {[-0.26, -0.09, 0.09, 0.26].map((x) =>
            [-0.28, 0.28].map((z) => (
              <Cilindro
                key={`${x}-${z}`}
                p={[x, topo - 0.34, z]}
                t={[0.09, 0.56, 0.09]}
                c={cor}
              />
            )),
          )}
        </group>
      );
    case "undercut":
      return (
        <group>
          <Bloco p={[0, topo - 0.05, 0.04]} t={[l * 0.92, 0.2, l * 0.9]} c={cor} />
          <Bloco p={[0, topo - 0.22, 0]} t={[l * 1.04, 0.16, l * 1.04]} c={escurecer(cor, 0.55)} />
        </group>
      );
    case "chanel":
      return (
        <group>
          {casca}
          {[-1, 1].map((s) => (
            <Bloco key={s} p={[s * l * 0.52, m.yCabeca + 0.02, 0]} t={[0.13, l * 0.8, l]} c={cor} />
          ))}
          <Bloco p={[0, m.yCabeca + 0.02, -l * 0.5]} t={[l * 1.02, l * 0.8, 0.13]} c={cor} />
          <Bloco p={[0, topo - 0.24, l * 0.48]} t={[l * 1.04, 0.24, 0.1]} c={cor} />
        </group>
      );
    default:
      return casca;
  }
}

// --------------------------------------------------------------- ROSTO
function Rosto({ f, m, pele }: { f: FiguraV2; m: Medidas; pele: string }) {
  const y = m.yCabeca;
  const z = m.zRosto + 0.005;
  const olho = (x: number) => {
    switch (f.olhos) {
      case "fechado":
        return <Bloco key={x} p={[x, y + 0.08, z]} t={[0.14, 0.03, 0.01]} c={ESCURO} />;
      case "feliz":
        return (
          <group key={x}>
            <Bloco p={[x, y + 0.1, z]} t={[0.13, 0.03, 0.01]} c={ESCURO} />
            <Bloco p={[x, y + 0.06, z]} t={[0.05, 0.05, 0.01]} c={ESCURO} />
          </group>
        );
      case "bravo":
        return (
          <Bloco key={x} p={[x, y + 0.07, z]} t={[0.12, 0.09, 0.01]} r={[0, 0, x < 0 ? 0.3 : -0.3]} c={ESCURO} />
        );
      case "sono":
        return (
          <group key={x}>
            <Bloco p={[x, y + 0.07, z]} t={[0.13, 0.06, 0.01]} c={ESCURO} />
            <Bloco p={[x, y + 0.11, z]} t={[0.14, 0.04, 0.012]} c={escurecer(pele, 0.85)} />
          </group>
        );
      case "estrela":
        return (
          <group key={x}>
            <Bloco p={[x, y + 0.08, z]} t={[0.14, 0.05, 0.01]} c="#F0B429" brilha />
            <Bloco p={[x, y + 0.08, z]} t={[0.05, 0.14, 0.01]} c="#F0B429" brilha />
          </group>
        );
      case "surpreso":
        return (
          <group key={x}>
            <Bloco p={[x, y + 0.08, z]} t={[0.14, 0.14, 0.01]} c={BRANCO} />
            <Bloco p={[x, y + 0.08, z + 0.005]} t={[0.07, 0.07, 0.01]} c={ESCURO} />
          </group>
        );
      case "ciclope":
        return x < 0 ? null : (
          <group key={x}>
            <Bloco p={[0, y + 0.08, z]} t={[0.26, 0.16, 0.01]} c={BRANCO} />
            <Bloco p={[0, y + 0.08, z + 0.005]} t={[0.11, 0.11, 0.01]} c={ESCURO} />
          </group>
        );
      default:
        return (
          <group key={x}>
            <Bloco p={[x, y + 0.08, z]} t={[0.11, 0.13, 0.01]} c={BRANCO} />
            <Bloco p={[x, y + 0.08, z + 0.005]} t={[0.06, 0.09, 0.01]} c={ESCURO} />
          </group>
        );
    }
  };

  const sobrancelha = (x: number) => {
    if (f.sobrancelha === "unica") {
      return x < 0 ? (
        <Bloco key={x} p={[0, y + 0.2, z]} t={[0.42, 0.035, 0.01]} c={ESCURO} />
      ) : null;
    }
    const t: [number, number, number] =
      f.sobrancelha === "grossa"
        ? [0.16, 0.055, 0.01]
        : f.sobrancelha === "fina"
          ? [0.15, 0.022, 0.01]
          : [0.16, 0.035, 0.01];
    const alt = f.sobrancelha === "alta" ? 0.24 : 0.2;
    const giro = f.sobrancelha === "brava" ? (x < 0 ? -0.34 : 0.34) : 0;
    return <Bloco key={x} p={[x, y + alt, z]} t={t} r={[0, 0, giro]} c={ESCURO} />;
  };

  const boca = () => {
    const by = y - 0.14;
    switch (f.boca) {
      case "serio":
        return <Bloco p={[0, by, z]} t={[0.2, 0.03, 0.01]} c={escurecer(pele, 0.55)} />;
      case "aberto":
        return (
          <group>
            <Bloco p={[0, by, z]} t={[0.18, 0.14, 0.01]} c={ESCURO} />
            <Bloco p={[0, by + 0.05, z + 0.005]} t={[0.16, 0.03, 0.01]} c={BRANCO} />
          </group>
        );
      case "torto":
        return <Bloco p={[0.03, by, z]} t={[0.2, 0.04, 0.01]} r={[0, 0, 0.28]} c={escurecer(pele, 0.5)} />;
      case "bico":
        return <Bloco p={[0, by, z + 0.01]} t={[0.11, 0.09, 0.03]} c={escurecer(pele, 0.62)} />;
      case "dentes":
        return (
          <group>
            <Bloco p={[0, by, z]} t={[0.26, 0.12, 0.01]} c={ESCURO} />
            <Bloco p={[0, by + 0.03, z + 0.005]} t={[0.24, 0.06, 0.01]} c={BRANCO} />
          </group>
        );
      case "triste":
        return (
          <group>
            <Bloco p={[0, by, z]} t={[0.16, 0.03, 0.01]} c={escurecer(pele, 0.5)} />
            {[-1, 1].map((s) => (
              <Bloco key={s} p={[s * 0.09, by + 0.03, z]} t={[0.07, 0.03, 0.01]} r={[0, 0, s * 0.6]} c={escurecer(pele, 0.5)} />
            ))}
          </group>
        );
      case "lingua":
        return (
          <group>
            <Bloco p={[0, by, z]} t={[0.2, 0.08, 0.01]} c={ESCURO} />
            <Bloco p={[0, by - 0.07, z + 0.01]} t={[0.11, 0.1, 0.03]} c="#E5484D" />
          </group>
        );
      default:
        return (
          <group>
            <Bloco p={[0, by, z]} t={[0.18, 0.035, 0.01]} c={escurecer(pele, 0.5)} />
            {[-1, 1].map((s) => (
              <Bloco key={s} p={[s * 0.1, by + 0.03, z]} t={[0.06, 0.035, 0.01]} r={[0, 0, s * -0.6]} c={escurecer(pele, 0.5)} />
            ))}
          </group>
        );
    }
  };

  const cor = CABELOS[f.barbaCor] ?? CABELOS[0];
  const barba = () => {
    switch (f.barba) {
      case "nenhuma":
        return null;
      case "bigode":
        return <Bloco p={[0, y - 0.06, z]} t={[0.22, 0.05, 0.01]} c={cor} />;
      case "cavanhaque":
        return (
          <group>
            <Bloco p={[0, y - 0.06, z]} t={[0.22, 0.05, 0.01]} c={cor} />
            <Bloco p={[0, y - 0.26, z]} t={[0.13, 0.13, 0.01]} c={cor} />
          </group>
        );
      case "bode":
        return <Bloco p={[0, y - 0.26, z]} t={[0.1, 0.16, 0.02]} c={cor} />;
      case "costeleta":
        return (
          <group>
            {[-1, 1].map((s) => (
              <Bloco key={s} p={[s * (m.cabeca / 2 - 0.02), y - 0.02, 0]} t={[0.03, 0.3, m.cabeca * 0.5]} c={cor} />
            ))}
          </group>
        );
      default:
        return (
          <group>
            <Bloco p={[0, y - 0.22, z - 0.02]} t={[m.cabeca * 0.9, 0.28, 0.06]} c={cor} />
            {[-1, 1].map((s) => (
              <Bloco key={s} p={[s * (m.cabeca / 2 - 0.02), y - 0.08, 0]} t={[0.04, 0.34, m.cabeca * 0.6]} c={cor} />
            ))}
            <Bloco p={[0, y - 0.06, z]} t={[0.24, 0.05, 0.01]} c={cor} />
          </group>
        );
    }
  };

  return (
    <group>
      {[-0.18, 0.18].map(olho)}
      {[-0.18, 0.18].map(sobrancelha)}
      {boca()}
      {barba()}
    </group>
  );
}

// ----------------------------------------------------------- PERSONAGEM
export function Personagem({ figura }: { figura: FiguraV2 }) {
  const m = medidasDe(figura.corpo);
  const pele = PELES[figura.pele] ?? PELES[0];
  const cabeloCor = CABELOS[figura.cabeloCor] ?? CABELOS[0];

  const equipados = Object.entries(figura.equipado).flatMap(([slot, id]) => {
    const cat = id ? POR_ID.get(id) : undefined;
    const Forma = cat ? FORMAS[cat.forma] : undefined;
    return Forma ? [{ slot, cat: cat!, Forma }] : [];
  });

  // Capacete e cabeça de tubarão comem o cabelo. Sem isso o moicano atravessa o
  // capacete, que é o tipo de coisa que faz o item parecer quebrado.
  const semCabelo = equipados.some((e) => e.cat.escondeCabelo);

  // A pele das pernas e do tronco só aparece onde não há roupa. Desenhar o
  // corpo inteiro por baixo é mais barato que calcular recortes.
  return (
    <group>
      {/* pernas */}
      {[-1, 1].map((s) => (
        <Bloco
          key={s}
          p={[s * (m.perna / 2 + 0.015), m.pernaA / 2, 0]}
          t={[m.perna, m.pernaA, m.perna]}
          c={pele}
        />
      ))}

      {/* tronco */}
      <Bloco p={[0, m.yTorso, 0]} t={[m.torsoL, m.torsoA, m.torsoP]} c={pele} />

      {/* braços */}
      {[-1, 1].map((s) => (
        <Bloco
          key={s}
          p={[s * (m.torsoL / 2 + m.braco / 2), m.yTorso + m.torsoA / 2 - m.bracoA / 2, 0]}
          t={[m.braco, m.bracoA, m.braco]}
          c={pele}
        />
      ))}

      {/* pescoço e cabeça */}
      <Bloco p={[0, m.pernaA + m.torsoA + 0.03, 0]} t={[m.cabeca * 0.34, 0.12, m.cabeca * 0.34]} c={escurecer(pele, 0.9)} />
      <Bloco p={[0, m.yCabeca, 0]} t={[m.cabeca, m.cabeca, m.cabeca]} c={pele} />

      {!semCabelo && <Cabelo estilo={figura.cabelo} cor={cabeloCor} m={m} />}
      <Rosto f={figura} m={m} pele={pele} />

      {equipados.map(({ slot, cat, Forma }) => (
        <Forma key={slot} c={cat.cores} m={m} />
      ))}
    </group>
  );
}
