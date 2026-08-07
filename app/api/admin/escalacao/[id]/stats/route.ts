/**
 * POST /api/admin/escalacao/[id]/stats — lança os stats de um atleta.
 *
 * Com `preview: true` NADA é gravado: devolve só o breakdown itemizado para o
 * apurador conferir antes. É a trava mais barata contra erro de digitação num
 * modo que emite moeda — e o Art. 34 exige que esse detalhe exista de qualquer
 * forma.
 *
 * O corpo é genérico de propósito: o formulário é gerado a partir de
 * `escalacao_regra.stats`, então esta rota não sabe (nem precisa saber) o que é
 * um round, uma bateria ou uma volta rápida.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { COLUNAS_REGRA, pontuarAtleta, rulesetDaLinha, type LinhaStat } from "@/lib/escalacao/apuracao";
import { exigirAdmin } from "@/lib/escalacao/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  card_atleta_id: z.string().uuid(),
  evento_key: z.string().min(1).max(60),
  preview: z.boolean().optional(),
  competiu: z.boolean().nullable().optional(),
  motivo_ausencia: z.string().max(200).nullable().optional(),
  linhas: z
    .array(
      z.object({
        ordem: z.number().int().min(0).max(200),
        stat_key: z.string().min(1),
        valor_num: z.number().nullable().optional(),
        valor_txt: z.string().nullable().optional(),
        contexto: z.record(z.string(), z.number()).nullable().optional(),
      })
    )
    .max(500),
});

export async function POST(request: Request, { params }: RouteParams) {
  const { id: cardId } = await params;
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;
  const { admin, userId } = guarda;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const body = parsed.data;

  const { data: atleta } = await admin
    .from("escalacao_card_atleta")
    .select("id, card_id, esporte_key, regra_id")
    .eq("id", body.card_atleta_id)
    .single();
  if (!atleta || atleta.card_id !== cardId) {
    return NextResponse.json({ error: "Atleta não pertence a este card" }, { status: 400 });
  }

  const { data: regra } = await admin
    .from("escalacao_regra")
    .select(COLUNAS_REGRA)
    .eq("id", atleta.regra_id)
    .single();
  if (!regra) return NextResponse.json({ error: "Ruleset não encontrado" }, { status: 400 });

  const { data: cardEsporte } = await admin
    .from("escalacao_card_esporte")
    .select("evento_key")
    .eq("card_id", cardId)
    .eq("esporte_key", atleta.esporte_key)
    .single();

  const ruleset = rulesetDaLinha(regra);
  const novas: LinhaStat[] = body.linhas.map((l) => ({
    evento_key: body.evento_key,
    ordem: l.ordem,
    stat_key: l.stat_key,
    valor_num: l.valor_num ?? null,
    valor_txt: l.valor_txt ?? null,
    contexto: l.contexto ?? null,
  }));

  // O preview precisa mostrar o MÊS, não só o evento que está sendo digitado:
  // no UFC duas lutas somam e no surf só o stop designado conta — um preview
  // do evento isolado mentiria justamente nos casos que importam.
  const { data: outras } = await admin
    .from("escalacao_stat")
    .select("evento_key, ordem, stat_key, valor_num, valor_txt, contexto")
    .eq("card_atleta_id", body.card_atleta_id)
    .neq("evento_key", body.evento_key);

  const linhasDoMes: LinhaStat[] = [
    ...novas,
    ...(outras ?? []).map((s) => ({
      evento_key: s.evento_key,
      ordem: s.ordem,
      stat_key: s.stat_key,
      valor_num: s.valor_num === null ? null : Number(s.valor_num),
      valor_txt: s.valor_txt,
      contexto: s.contexto,
    })),
  ];

  const resultado = pontuarAtleta(ruleset, linhasDoMes, cardEsporte?.evento_key);

  if (body.preview) {
    return NextResponse.json({ success: true, preview: true, resultado });
  }

  // Substituição completa do evento: relançar corrige, nunca acumula.
  const { error: erroLimpeza } = await admin
    .from("escalacao_stat")
    .delete()
    .eq("card_atleta_id", body.card_atleta_id)
    .eq("evento_key", body.evento_key);
  if (erroLimpeza) return NextResponse.json({ error: erroLimpeza.message }, { status: 400 });

  if (novas.length > 0) {
    const { error } = await admin.from("escalacao_stat").insert(
      novas.map((l) => ({
        card_atleta_id: body.card_atleta_id,
        evento_key: l.evento_key,
        ordem: l.ordem,
        stat_key: l.stat_key,
        valor_num: l.valor_num,
        valor_txt: l.valor_txt,
        contexto: l.contexto,
        registrado_por: userId,
      }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.competiu !== undefined) {
    const { error } = await admin
      .from("escalacao_card_atleta")
      .update({ competiu: body.competiu, motivo_ausencia: body.motivo_ausencia ?? null })
      .eq("id", body.card_atleta_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath(`/admin/escalacao/${cardId}/apuracao`);
  return NextResponse.json({ success: true, resultado });
}
