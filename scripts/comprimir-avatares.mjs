// Segundo tempo da montagem do cast: comprime os `.glb` que o Blender cospe.
//
// POR QUE NÃO ESTÁ DENTRO DO build_avatars.py
//
// O exportador glTF do Blender não faz nada disto. O que baixa 943 KB para 94
// não é uma opção de export, é um pipeline de ferramentas de glTF que só existe
// em Node — e das quatro coisas que ele faz, três não são "compressão":
//
//   join    — funde as onze malhas do personagem numa só;
//   palette — funde os onze materiais de cor chapada num só, com as cores num
//             atlas minúsculo. Junto com o `join`, é o que leva o personagem de
//             onze chamadas de desenho para UMA. Vale mais em celular que o
//             tamanho do arquivo.
//   simplify— tira ~19% dos triângulos sem diferença visível a olho, porque a
//             subdivisão do Blender gera densidade uniforme e boa parte dela cai
//             em superfície plana;
//   draco   — só então comprime a geometria que sobrou.
//
// A ORDEM IMPORTA E É O PADRÃO DO `optimize`
//
// `simplify` depois de `join` decima o personagem inteiro com um orçamento só,
// em vez de gastar o mesmo esforço na sola do tênis e no rosto. Rodar na mão,
// fora dessa ordem, é como se perde silhueta.
//
// IDEMPOTENTE DE PROPÓSITO
//
// Roda sobre o arquivo no lugar. Passar duas vezes no mesmo `.glb` é inofensivo
// (a segunda descomprime, refaz e recomprime), então não há estado a lembrar:
// depois de qualquer rodada do Blender, roda isto e pronto.
//
//   node scripts/comprimir-avatares.mjs
//
// O decodificador que o navegador precisa está em `public/draco/`, servido do
// próprio domínio — ver `components/figura3d/avatar/Modelo.tsx`.

import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASTA = path.join(RAIZ, "public", "avatares");

const arquivos = readdirSync(PASTA)
  .filter((f) => f.endsWith(".glb"))
  .sort();

if (arquivos.length === 0) {
  console.error(`nada para comprimir em ${PASTA} — rode o build_avatars.py antes`);
  process.exit(1);
}

let antes = 0;
let depois = 0;

for (const nome of arquivos) {
  const alvo = path.join(PASTA, nome);
  const kbAntes = statSync(alvo).size / 1024;

  execFileSync(
    "npx",
    [
      "--yes",
      "@gltf-transform/cli@^4",
      "optimize",
      alvo,
      alvo,
      "--compress",
      "draco",
      // Não há textura a comprimir: as cores viram um atlas de poucos pixels no
      // `palette`, e mandar o KTX2 nele custa minutos e devolve bytes a mais.
      "--texture-compress",
      "false",
      // O `palette` só assa um canal em atlas se achar 5 valores distintos
      // dele. As cores passam fácil; os acabamentos de `MATERIAL_PRESETS` não —
      // o ninja usa três rugosidades, o astronauta três. Abaixo do mínimo o
      // canal volta a ser propriedade de material, os materiais deixam de ser
      // iguais e o `join` não funde: o ninja saía com 4 chamadas de desenho e
      // 148 KB em vez de 1 e 136 KB. Com 2, todo personagem volta a UMA.
      "--palette-min",
      "2",
    ],
    { cwd: RAIZ, stdio: ["ignore", "ignore", "pipe"] },
  );

  const kbDepois = statSync(alvo).size / 1024;
  antes += kbAntes;
  depois += kbDepois;
  console.log(`${nome.padEnd(28)} ${kbAntes.toFixed(0).padStart(5)} KB -> ${kbDepois.toFixed(0)} KB`);
}

console.log(
  `\n${arquivos.length} arquivos: ${(antes / 1024).toFixed(1)} MB -> ${(depois / 1024).toFixed(1)} MB`,
);
