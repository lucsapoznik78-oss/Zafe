// A altura em que o cast é desenhado.
//
// Os trinta personagens prontos são malha esculpida, cada um com a própria
// altura em metros de Blender. O carregador normaliza todos para este número
// (`Modelo.tsx`), e é isso que faz o elenco aparecer alinhado: sem normalizar,
// o Rei — mais alto por causa da coroa — seria maior que o resto na loja.
//
// Não é a mesma proporção do boneco montável de `primitivas.ts`, e não precisa
// ser: o avatar pronto é um objeto FECHADO, comprado inteiro, que não recebe os
// acessórios avulsos. Aqui morava também o rig de trinta bonecos gerados por
// código — cabeça, tronco, membros e doze poses de ângulos à mão. Saiu junto
// com a geometria que ele posicionava, quando os `.glb` entraram.

/** Altura total do personagem, do chão ao topo do crânio. */
export const ALTURA = 2.86;

/**
 * Altura, em metros de Blender, do adulto de pé dos packs — a régua contra a
 * qual TODO `.glb` do cast é escalado, sempre pelo mesmo número.
 *
 * A versão anterior media cada arquivo e o esticava até `ALTURA`. Parece mais
 * robusto e é o contrário: a caixa que se mede não é a altura do personagem, é
 * a altura da POSE. A capitã de braços fechados mede 1,34 e a bruxa de chapéu
 * de bico mede 1,66; normalizar as duas para o mesmo número amplia a capitã em
 * 24% sobre a bruxa — ela fica maior, mais inclinada e estourando o
 * enquadramento, exatamente por estar fechada. Quem agacha cresce.
 *
 * Com um fator único, inclinar-se volta a diminuir a silhueta (que é o certo) e
 * a diferença de altura entre personagens passa a significar o que de fato é:
 * coroa, chapéu, cabelo. `build_avatars.py` recusa exportar fora da faixa, então
 * nenhum arquivo novo pode furar a régua em silêncio.
 *
 * É a mediana dos trinta e tem de bater com `ALTURA_BASE` do script.
 */
export const ALTURA_BASE_GLB = 1.42;

/** Fator único aplicado a todo modelo do cast. */
export const ESCALA_GLB = ALTURA / ALTURA_BASE_GLB;

/**
 * O teto do cast na escala da cena — o personagem mais alto que pode existir.
 *
 * É o `ALTURA_MAX` de `build_avatars.py` convertido, e a câmera é enquadrada
 * por ele, não pelo personagem em tela. Com enquadramento por personagem os
 * trinta sairiam do mesmo tamanho no card e a coleção perderia a única pista
 * de escala que tem; travando no teto, a bruxa de chapéu chega perto do topo e
 * o boxeador encolhido sobra embaixo, que é a leitura correta.
 */
export const ALTURA_MAX_CENA = (1.8 / ALTURA_BASE_GLB) * ALTURA;

export const R = {
  altura: ALTURA,
} as const;
