// Monta um dos 30 personagens prontos a partir da linha do catálogo.
//
// ONDE CADA COISA PIVOTA, E POR QUÊ
//
// Tudo do quadril para cima é filho de UM grupo que gira em `pose.tronco` e
// desloca em `pose.desvioQuadril`. As pernas são filhas da raiz. Essa divisão é
// o hipshot inteiro: o peso vai para uma perna, o quadril sai do eixo, o tronco
// compensa — e os pés continuam no chão. Se as pernas pendurassem do mesmo
// pivô, inclinar o tronco levantaria um pé do chão e a pose viraria queda.
//
// Cada braço gira no ombro, o antebraço gira no cotovelo, e o prop é filho do
// punho. Por isso não existe nenhuma conta de "onde está a mão nesta pose":
// a hierarquia responde sozinha.
//
// A pose vem do RIG (`pose3d`), não do catálogo: o catálogo só diz QUAL pose.
// São dez poses para trinta personagens, e é isso que mantém o cast coerente —
// trinta conjuntos de ângulos avulsos viravam trinta bonecos de jogos
// diferentes.

"use client";

import type { AvatarCatalogo } from "@/lib/figura/avatares";
import { PELES } from "@/lib/figura/paletas";

import { Aura, CostasAvatar, PropAvatar } from "./adornos";
import { Braco, Perna, Tronco } from "./corpo";
import { CabecaAvatar } from "./partes";
import { R, pose3d } from "./rig";

export function Avatar3D({ av }: { av: AvatarCatalogo }) {
  const pele = PELES[av.pele] ?? PELES[2];
  const pose = pose3d(av.pose);

  // Prop de duas mãos ocupa o corpo inteiro: o outro lado fica vazio mesmo que
  // o catálogo tenha preenchido, senão a prancha e o celular disputam espaço.
  const maoEsq = av.maoDir?.duasMaos ? undefined : av.maoEsq;

  return (
    <group>
      <group position={[pose.desvioQuadril, R.yQuadril, 0]} rotation={pose.tronco}>
        <Tronco roupa={av.roupa} pele={pele} />
        {av.costas && <CostasAvatar costas={av.costas} />}

        <group position={[0, R.torsoA + R.pescocoA, 0]} rotation={pose.cabeca}>
          <group position={[0, R.meiaCabeca, 0]}>
            <CabecaAvatar
              pele={pele}
              cabelo={av.cabelo}
              rosto={av.rosto}
              chapeu={av.chapeu}
              face={av.face}
            />
          </group>
        </group>

        <Braco
          lado={-1}
          roupa={av.roupa}
          pele={pele}
          ombro={pose.ombroDir}
          cotovelo={pose.cotoveloDir}
          // Segurar alguma coisa fecha a mão, mesmo que a pose não peça.
          punho={pose.punhoDir || Boolean(av.maoDir)}
        >
          {av.maoDir && <PropAvatar prop={av.maoDir} lado={-1} />}
        </Braco>

        <Braco
          lado={1}
          roupa={av.roupa}
          pele={pele}
          ombro={pose.ombroEsq}
          cotovelo={pose.cotoveloEsq}
          punho={pose.punhoEsq || Boolean(maoEsq)}
        >
          {maoEsq && <PropAvatar prop={maoEsq} lado={1} />}
        </Braco>
      </group>

      {/* Só uma fração do desvio chega às pernas: o quadril arrasta a coxa um
          pouco, não a perna inteira. */}
      <group position={[pose.desvioQuadril * 0.4, R.yQuadril, 0]}>
        <Perna
          lado={-1}
          baixo={av.baixo}
          calcado={av.calcado}
          pele={pele}
          giro={pose.quadrilDir}
        />
        <Perna lado={1} baixo={av.baixo} calcado={av.calcado} pele={pele} giro={pose.quadrilEsq} />
      </group>

      {av.aura && <Aura cor={av.aura} />}
    </group>
  );
}
