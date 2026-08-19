// A iluminação, num lugar só.
//
// POR QUE ISTO É UM COMPONENTE E NÃO DUAS LISTAS DE <light> SOLTAS
//
// São dois canvas — o editor e a folha de miniaturas — e a miniatura é a
// PROPAGANDA do que o editor mostra. Se as luzes divergirem, o card vende um
// personagem com outra cara. Um componente compartilhado é o que impede a
// divergência de acontecer por descuido num arquivo só.
//
// O QUE MUDOU, E POR QUE IMPORTAVA
//
// Antes eram duas luzes: uma direcional frontal-alta e um hemisférico. Isso
// acende tudo por igual e mata a separação entre o personagem e o fundo — o
// boneco vira adesivo colado na tela. Uma cena de retrato precisa de três
// funções distintas, e a que faltava é a que mais rende:
//
//   KEY  — a que modela. Vem de três quartos e de cima: luz frontal apaga
//          volume, porque ilumina igualmente o que avança e o que recua. A 45°
//          a gola, a dobra da manga e o maxilar ganham lado claro e lado
//          escuro, e o olho lê profundidade.
//   FILL — fraca, fria, do lado oposto. Não é para iluminar: é para a sombra
//          não fechar em preto puro, que em cor chapada lê como buraco.
//   RIM  — atrás e acima, oposta ao key, fria. Desenha um fio de luz no
//          contorno do ombro, do cabelo e do braço. É o que descola a silhueta
//          do fundo, e é o item mais barato desta lista inteira: uma luz
//          direcional, zero geometria, zero textura, zero download.
//
// `castShadow` continua desligado no app inteiro: shadow map é o custo isolado
// mais alto numa GPU de celular e num boneco de blocos rende quase nada. O
// contato com o chão é resolvido à parte, no editor, por `ContactShadows`.
//
// NOTA SOBRE ENVIRONMENT/HDRI — `<Environment />` do drei preenche
// `scene.environment`, e o three só aplica isso a `isMeshStandardMaterial`
// (`WebGLRenderer.js`: `material.isMeshStandardMaterial ? scene.environment :
// null`). Nossos materiais são `MeshLambertMaterial`, então um HDRI aqui seria
// download e memória sem um pixel de diferença. Só passa a valer junto com a
// troca para PBR — outra decisão, com outro custo em celular.

"use client";

export function Luzes() {
  return (
    <>
      <hemisphereLight args={["#DDE6F5", "#20232A", 0.55]} />
      <directionalLight position={[4.2, 6.5, 4.8]} intensity={1.25} color="#FFF6E8" />
      <directionalLight position={[-4.5, 4.2, -5.5]} intensity={1.15} color="#9FC4FF" />
      <directionalLight position={[-2.5, 1.2, 3.5]} intensity={0.28} color="#BFD4FF" />
    </>
  );
}
