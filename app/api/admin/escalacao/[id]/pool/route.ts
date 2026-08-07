/**
 * POST /api/admin/escalacao/[id]/pool — importa o pool publicado do card.
 *
 * Body: { csv: string } com uma linha por atleta:
 *   esporte,competicao_slug,nome,genero,referencia
 *
 * Cria o atleta no cadastro permanente se ele ainda não existir (chave: slug
 * derivado do nome + esporte) e o inclui no pool deste card. Reimportar é
 * idempotente: atleta já no pool é ignorado, não duplicado.
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

  const linhas = csv.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const [i, linha] of linhas.entries()) {
    const [esporte, compSlug, nome, genero, referencia] = linha.split(",").map((c) => c.trim());
    const numero = i + 1;

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
