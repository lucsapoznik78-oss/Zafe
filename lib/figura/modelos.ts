// Onde mora o modelo esculpido de cada personagem do cast.
//
// Os trinta são malha esculpida em glTF, montada a partir dos packs CC0 da
// Quaternius por `scripts/blender/build_avatars.py`. O `id` do catálogo
// (`lib/figura/avatares.ts`) É o nome do arquivo — o script constrói a lista de
// personagens lendo o próprio catálogo, então não existe um segundo lugar onde
// alguém possa esquecer de registrar um avatar novo.
//
// Aqui morava um manifesto de "quais já migraram", de quando o cast era metade
// geometria gerada em runtime. Ele saiu junto com a última linha procedural: uma
// lista de trinta ids escrita à mão ao lado de outra lista de trinta ids é o
// tipo de duplicata que só avisa que dessincronizou quando alguém abre a loja e
// vê o personagem errado no card.
//
// O `.glb` não precisa vir numa escala combinada: o carregador mede a malha e
// normaliza a altura (ver `components/figura3d/avatar/Modelo.tsx`).

/** Caminho público do modelo de um personagem do cast. */
export function urlModelo(id: string): string {
  return `/avatares/${id}.glb`;
}
