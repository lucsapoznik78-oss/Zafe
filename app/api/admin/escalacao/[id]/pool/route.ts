/**
 * POST /api/admin/escalacao/[id]/pool — importa o pool publicado do card.
 *
 * Body: { csv: string } com uma linha por atleta. Dois formatos aceitos:
 *
 *   com header (recomendado):
 *     esporte,competicao_slug,nome,clube,posicao,foto_url,genero,referencia
 *
 *   legado (5 campos posicionais, sem header):
 *     esporte,competicao_slug,nome,genero,referencia
 *
 * `clube`, `posicao` e `foto_url` são opcionais. A UI da escalação usa as três
 * para renderizar o card estilo Cartola (migration 079). foto_url precisa ser
 * absoluta (http/https) — o CHECK constraint no banco recusa outros valores.
 *
 * Cria o atleta no cadastro permanente se ele ainda não existir (chave: slug
 * derivado do nome + esporte) e o inclui no pool deste card. Reimportar é
 * idempotente: atleta já no pool é ignorado, não duplicado; se o atleta já
 * existe, clube/posicao/foto_url são atualizados quando vierem preenchidos.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { exigirAdmin } from "@/lib/escalacao/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function slugificar(nome: string, esporte: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${esporte}-${base}`;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id: cardId } = await params;
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;
  const { admin } = guarda;

  const body = await request.json();
  const csv: string = typeof body.csv === "string" ? body.csv.trim() : "";
  if (!csv) return NextResponse.json({ error: "Cole o CSV do pool" }, { status: 400 });

  // Os esportes do card já fixaram o ruleset: o pool só aceita esporte que este
  // card adotou, e o regra_id sai daqui — nunca do CSV.
  const { data: esportes } = await admin
    .from("escalacao_card_esporte")
    .select("esporte_key, regra_id")
    .eq("card_id", cardId);
  const regraPorEsporte = new Map((esportes ?? []).map((e) => [e.esporte_key, e.regra_id]));
  if (regraPorEsporte.size === 0) {
    return NextResponse.json({ error: "Card sem esportes configurados" }, { status: 400 });
  }

  const { data: competicoes } = await admin.from("escalacao_competicao").select("id, slug");
  const competicaoPorSlug = new Map((competicoes ?? []).map((c) => [c.slug, c.id]));

  const erros: string[] = [];
  let importados = 0;

  const linhasBrutas = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  // Se a primeira linha começa com "esporte", tratamos como header e usamos a
  // ordem das colunas dela. Senão, cai no formato legado posicional de 5 campos.
  const primeira = linhasBrutas[0]?.split(",").map((c) => c.trim()) ?? [];
  const temHeader = primeira[0] === "esporte";
  const header = temHeader
    ? primeira
    : ["esporte", "competicao_slug", "nome", "genero", "referencia"];
  const linhas = temHeader ? linhasBrutas.slice(1) : linhasBrutas;

  for (const [i, linha] of linhas.entries()) {
    const partes = linha.split(",").map((c) => c.trim());
    const linhaObj: Record<string, string> = Object.fromEntries(
      header.map((h, j) => [h, partes[j] ?? ""])
    );
    const {
      esporte,
      competicao_slug: compSlug,
      nome,
      clube,
      posicao,
      foto_url: fotoUrl,
      genero,
      referencia,
    } = linhaObj;
    const numero = i + 1 + (temHeader ? 1 : 0);

    const regraId = regraPorEsporte.get(esporte);
    if (!regraId) {
      erros.push(`linha ${numero}: esporte "${esporte}" não está neste card`);
      continue;
    }
    if (!nome) {
      erros.push(`linha ${numero}: nome vazio`);
      continue;
    }
    const competicaoId = compSlug ? competicaoPorSlug.get(compSlug) : null;
    if (compSlug && !competicaoId) {
      erros.push(`linha ${numero}: competição "${compSlug}" não existe`);
      continue;
    }

    const slug = slugificar(nome, esporte);
    // foto_url precisa ser absoluta — o CHECK no banco recusa outros valores,
    // e enviar string vazia é distinto de NULL para PostgREST. Normaliza aqui.
    const fotoNorm = fotoUrl && /^https?:\/\//.test(fotoUrl) ? fotoUrl : null;
    const { data: atleta, error: erroAtleta } = await admin
      .from("escalacao_atleta")
      .upsert(
        {
          nome,
          slug,
          esporte_key: esporte,
          competicao_id: competicaoId ?? null,
          genero: genero === "m" || genero === "f" ? genero : "misto",
          external_ref: referencia || null,
          clube: clube || null,
          posicao: posicao || null,
          foto_url: fotoNorm,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (erroAtleta || !atleta) {
      erros.push(`linha ${numero}: ${erroAtleta?.message ?? "falha ao gravar atleta"}`);
      continue;
    }

    const { error: erroPool } = await admin.from("escalacao_card_atleta").upsert(
      {
        card_id: cardId,
        atleta_id: atleta.id,
        esporte_key: esporte,
        regra_id: regraId,
      },
      { onConflict: "card_id,atleta_id", ignoreDuplicates: true }
    );
    if (erroPool) {
      erros.push(`linha ${numero}: ${erroPool.message}`);
      continue;
    }
    importados++;
  }

  revalidatePath(`/admin/escalacao/${cardId}`);
  return NextResponse.json({ success: true, importados, erros });
}
