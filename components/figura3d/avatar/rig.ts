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

export const R = {
  altura: ALTURA,
} as const;
