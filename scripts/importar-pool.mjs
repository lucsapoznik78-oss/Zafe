#!/usr/bin/env node
/**
 * scripts/importar-pool.mjs — importador idempotente de atletas.
 *
 * Uso:
 *   node scripts/importar-pool.mjs <caminho-do-csv>
 *   cat pool.csv | node scripts/importar-pool.mjs -
 *
 * Formato CSV com header (recomendado):
 *   esporte,competicao_slug,nome,clube,posicao,foto_url,genero,referencia
 *
 * Formato legado (posicional, sem header — 5 campos):
 *   esporte,competicao_slug,nome,genero,referencia
 *
 * O importador é IDEMPOTENTE: usa o mesmo slug(nome, esporte) do endpoint HTTP
 * do admin (`app/api/admin/escalacao/[id]/pool/route.ts`). Rodar duas vezes
 * atualiza clube/posição/foto_url mas NÃO cria duplicata.
 *
 * Note bem: este script NÃO vincula atleta a card. Ele popula só o cadastro
 * permanente `escalacao_atleta`. Para vincular ao pool de um card específico,
 * use o endpoint do admin (que faz upsert em `escalacao_card_atleta`).
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam env vars: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Mesma função de slug do endpoint HTTP — trocá-la aqui sem trocar lá quebra a
// idempotência (dois slugs distintos para o mesmo atleta).
function slugificar(nome, esporte) {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${esporte}-${base}`;
}

// Parser de CSV simples: sem aspas, sem escape. Suficiente para os CSVs curados
// que a gente controla. Se um nome tiver vírgula, escrever com um placeholder.
function parseLinha(linha) {
  return linha.split(",").map((c) => c.trim());
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Uso: node scripts/importar-pool.mjs <csv|->");
    process.exit(1);
  }
  const bruto = arg === "-" ? readFileSync(0, "utf8") : readFileSync(arg, "utf8");
  const linhas = bruto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length === 0) {
    console.error("CSV vazio");
    process.exit(1);
  }

  // Detecta header. Se a primeira coluna for "esporte" literal, é header e a
  // ordem das colunas segue o header. Senão, formato legado posicional.
  const primeira = parseLinha(linhas[0]);
  const temHeader = primeira[0] === "esporte";
  const header = temHeader
    ? primeira
    : ["esporte", "competicao_slug", "nome", "genero", "referencia"];
  const dados = temHeader ? linhas.slice(1) : linhas;

  const { data: comps } = await supabase.from("escalacao_competicao").select("id, slug");
  const compPorSlug = new Map((comps ?? []).map((c) => [c.slug, c.id]));

  let ok = 0;
  let ignorados = 0;
  const erros = [];
  for (const [i, linha] of dados.entries()) {
    const numero = i + 1 + (temHeader ? 1 : 0);
    const partes = parseLinha(linha);
    const linhaObj = Object.fromEntries(header.map((h, j) => [h, partes[j] ?? ""]));

    const { esporte, competicao_slug, nome, clube, posicao, foto_url, genero, referencia } = linhaObj;
    if (!esporte || !nome) {
      erros.push(`linha ${numero}: esporte/nome obrigatórios`);
      continue;
    }

    let competicao_id = null;
    if (competicao_slug) {
      competicao_id = compPorSlug.get(competicao_slug) ?? null;
      if (!competicao_id) {
        erros.push(`linha ${numero}: competição "${competicao_slug}" não existe`);
        continue;
      }
    }

    const slug = slugificar(nome, esporte);
    const generoNorm = genero === "m" || genero === "f" ? genero : "misto";
    const fotoNorm = foto_url && /^https?:\/\//.test(foto_url) ? foto_url : null;

    const payload = {
      nome,
      slug,
      esporte_key: esporte,
      competicao_id,
      genero: generoNorm,
      external_ref: referencia || null,
      clube: clube || null,
      posicao: posicao || null,
      foto_url: fotoNorm,
    };
    const { error } = await supabase
      .from("escalacao_atleta")
      .upsert(payload, { onConflict: "slug" });
    if (error) {
      erros.push(`linha ${numero} (${slug}): ${error.message}`);
      continue;
    }
    ok++;
  }

  console.log(`Importados/atualizados: ${ok}`);
  if (ignorados) console.log(`Ignorados (já existiam iguais): ${ignorados}`);
  if (erros.length) {
    console.log(`Erros (${erros.length}):`);
    for (const e of erros) console.log("  " + e);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
