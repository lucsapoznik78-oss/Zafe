// A iluminação, num lugar só.
//
// POR QUE ISTO É UM COMPONENTE E NÃO UMA LISTA DE <light> SOLTA
//
// São dois canvas — o editor e a folha de miniaturas — e a miniatura é a
// PROPAGANDA do que o editor mostra. Se as luzes divergirem, o card vende um
// personagem com outra cara. Um componente compartilhado é o que impede a
// divergência de acontecer por descuido num arquivo só.
//
// AS TRÊS FUNÇÕES, E POR QUE SÃO EXATAMENTE TRÊS
//
//   KEY  — a que modela. Vem de três quartos e de cima: luz frontal apaga
//          volume, porque ilumina igualmente o que avança e o que recua. A 45°
//          a gola, a dobra da manga e o maxilar ganham lado claro e lado
//          escuro, e o olho lê profundidade. É a única que projeta sombra.
//   FILL — fraca, fria, do lado oposto. Não é para iluminar: é para a sombra
//          não fechar em preto puro, que em cor chapada lê como buraco.
//   RIM  — atrás e acima, oposta ao key, fria. Desenha um fio de luz no
//          contorno do ombro, do cabelo e do braço. É o que descola a silhueta
//          do fundo, e é o item mais barato desta lista inteira: uma luz
//          direcional, zero geometria, zero textura, zero download.
//
// Havia uma quarta, um `hemisphereLight`, fazendo as vezes de ambiente. Saiu:
// o `<Environment>` abaixo faz o mesmo trabalho melhor (a luz do ambiente
// chega com DIREÇÃO e com COR, não como um banho uniforme), e cada luz a mais
// é um passe a mais por fragmento.
//
// O AMBIENTE É CONSTRUÍDO, NÃO BAIXADO
//
// O caminho normal seria `<Environment preset="city" />`, que puxa um HDRI de
// um CDN. Aqui isso não roda: a CSP de `next.config.mjs` declara
// `connect-src 'self' <supabase>`, e o fetch do preset morre bloqueado — em
// produção, silenciosamente, deixando a cena sem ambiente nenhum.
//
// Com filhos, o `<Environment>` do drei renderiza a própria cena num cube
// render target: os `<Lightformer>` abaixo SÃO o HDRI, gerados na GPU, uma vez
// (`frames={1}`), sem um byte de rede. É um estúdio de três paredes — teto
// quente, parede fria atrás, chão escuro — que é justamente o que um HDRI de
// estúdio contém.
//
// `environmentIntensity` baixo de propósito: o ambiente é o que tira o preto
// morto da sombra e devolve reflexo à roupa, não é fonte de luz. Quem modela é
// a key.
//
// A QUEM ISTO SE APLICA
//
// `scene.environment` só afeta `isMeshStandardMaterial` — regra do próprio
// three (`WebGLRenderer.js`). O cast vem de `.glb` e é Standard; o boneco
// montável de `primitivas.ts` é Lambert e ignora. Não é incoerência em tela:
// `Personagem.tsx` mostra um OU outro, nunca os dois juntos.

"use client";

import { Environment, Lightformer } from "@react-three/drei";

import { ALTURA_MAX_CENA } from "./avatar/rig";

/**
 * O frustum da sombra, apertado em volta do personagem.
 *
 * O default do three cobre uma área enorme e gasta o shadow map inteiro
 * fotografando o vazio — o resultado é a sombra serrilhada que faz parecer bug
 * de renderizador. Estes números saem da caixa que o cast pode ocupar
 * (`ALTURA_MAX_CENA`) mais folga para prop na mão, e não de tentativa e erro:
 * mudar a altura do cast reaperta o frustum sozinho.
 */
const RAIO_SOMBRA = ALTURA_MAX_CENA * 0.62;

/** Distância da key à origem — define o near/far do shadow camera. */
const DIST_KEY = Math.hypot(4.2, 6.5, 4.8);

/**
 * `hdri` para o cast (`.glb`, `MeshStandardMaterial`) e `plano` para a folha de
 * miniaturas dos itens.
 *
 * Não é preferência: os itens da loja são `MeshLambertMaterial`, e Lambert
 * ignora `scene.environment` por regra do three. Ali o cube render seria custo
 * e risco puros — e risco de verdade, porque aquele canvas roda em
 * `frameloop="demand"` e tira a foto em dois `requestAnimationFrame`, sem
 * garantir que o passe do ambiente já rodou. O hemisférico dá a mesma função
 * (não deixar a sombra fechar) num material que sabe recebê-la.
 */
export function Luzes({ ambiente = "hdri" }: { ambiente?: "hdri" | "plano" }) {
  return (
    <>
      {ambiente === "plano" ? (
        <hemisphereLight args={["#DDE6F5", "#20232A", 0.55]} />
      ) : (
        <Environment resolution={128} frames={1} environmentIntensity={0.5}>
          {/* teto, quente e largo: é o que preenche o alto do ombro */}
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#FFF1DC"
            position={[0, 6, 2]}
            rotation-x={Math.PI / 2}
            scale={[10, 10, 1]}
          />
          {/* parede de trás, fria: dá o reflexo azulado na borda que a rim
              desenha, para o contorno não ser uma linha branca isolada.
              Baixada junto com a rim — as duas somavam o mesmo azul na mesma
              face, e a soma é que virava mancha. */}
          <Lightformer
            form="rect"
            intensity={1.0}
            color="#9DBBF0"
            position={[0, 3, -8]}
            scale={[12, 8, 1]}
          />
          {/* chão escuro: sem ele o ambiente ilumina por baixo e o queixo fica
              com aquela luz de lanterna embaixo do rosto */}
          <Lightformer
            form="rect"
            intensity={0.25}
            color="#151922"
            position={[0, -4, 0]}
            rotation-x={-Math.PI / 2}
            scale={[12, 12, 1]}
          />
        </Environment>
      )}

      {/* KEY */}
      <directionalLight
        position={[4.2, 6.5, 4.8]}
        intensity={2.3}
        color="#FFF4E6"
        castShadow
        // 1024 é a linha do orçamento para uma luz com sombra. Não há segunda.
        shadow-mapSize={[1024, 1024]}
        // `bias` negativo pequeno tira o acne; `normalBias` tira o peter-panning
        // (a sombra descolando do pé) sem precisar de bias grande, que é o que
        // faz a sombra vazar por dentro da malha.
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={DIST_KEY - RAIO_SOMBRA * 1.5}
        shadow-camera-far={DIST_KEY + RAIO_SOMBRA * 1.5}
        shadow-camera-left={-RAIO_SOMBRA}
        shadow-camera-right={RAIO_SOMBRA}
        shadow-camera-top={RAIO_SOMBRA}
        shadow-camera-bottom={-RAIO_SOMBRA}
      />

      {/* FILL */}
      <directionalLight position={[-4.5, 2.4, 2.2]} intensity={0.42} color="#94A8C6" />

      {/* RIM — Z negativo, atrás do personagem. Se o fio de luz sumir, é aqui
          que se mexe: intensidade primeiro, posição depois.

          1,15 e não 2,6, e azul lavado no lugar do azul saturado. Uma rim
          DIRECIONAL não ilumina só o contorno: ela banha todo o hemisfério
          virado para trás e para cima. A 2,6 em #A9C9FF isso depositava azul no
          antebraço, na coxa, na dobra da calça e no cabelo preto — as "manchas
          cinza-azuladas" que apareciam em quase todo o cast, e que ficavam
          gritantes justamente onde o albedo é saturado (terno vermelho) ou
          escuro (cabelo), porque ali o azul não tem com o que competir.

          O fio de luz não se perde: uma rim lê por CONTRASTE com o fundo, não
          por intensidade absoluta, e o fundo desta cena é escuro. Metade da
          intensidade continua descolando a silhueta e para de pintar o meio da
          superfície. */}
      <directionalLight position={[-2.0, 5.0, -5.8]} intensity={1.15} color="#CBD8EE" />
    </>
  );
}
