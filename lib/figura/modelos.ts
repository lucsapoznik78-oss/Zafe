// Quais personagens do cast já têm modelo esculpido, e onde ele mora.
//
// POR QUE UM MANIFESTO, E NÃO "TENTA CARREGAR E VÊ NO QUE DÁ"
//
// Os trinta personagens estão migrando de geometria gerada em runtime (cápsulas
// e caixas montadas por código) para malhas esculpidas exportadas em glTF. A
// migração é gradual — um `.glb` de cada vez, conforme cada um fica pronto — e
// durante a travessia os dois caminhos precisam conviver.
//
// A alternativa seria pedir o arquivo e cair no procedural quando o servidor
// respondesse 404. Não serve: a folha de miniaturas monta os trinta de uma vez,
// então cada avatar ainda não migrado custaria uma requisição perdida, e o
// console viraria uma parede de erro vermelho que esconde erro de verdade. Uma
// lista explícita custa uma linha por personagem e não pede nada à rede.
//
// COMO ADICIONAR UM PERSONAGEM
//
// 1. Exporte o modelo como `public/avatares/<id>.glb`, com o `id` EXATAMENTE
//    igual ao do catálogo (`lib/figura/avatares.ts`) — é a chave que liga os
//    dois lados, e um typo aqui devolve silenciosamente o boneco antigo.
// 2. Acrescente o mesmo `id` ao conjunto abaixo.
//
// Não é preciso exportar numa escala ou numa altura combinada: o carregador
// mede a malha e normaliza (ver `components/figura3d/avatar/Modelo.tsx`).

/**
 * Ids do catálogo que já têm `.glb`. Vazio significa "o cast inteiro ainda é
 * procedural" — que é um estado válido, não um pendente.
 */
export const COM_MODELO: ReadonlySet<string> = new Set<string>([]);

/** Caminho público do modelo, ou `undefined` se este ainda não foi esculpido. */
export function urlModelo(id: string): string | undefined {
  return COM_MODELO.has(id) ? `/avatares/${id}.glb` : undefined;
}
