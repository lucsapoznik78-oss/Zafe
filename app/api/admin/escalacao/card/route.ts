/**
 * POST /api/admin/escalacao/card — cria um card (Convocação) em rascunho.
 *
 * O card nasce SEMPRE em rascunho: publicar é outro endpoint, porque a partir
 * do `status <> 'rascunho'` o trigger T6 congela preço e regras (Art. 33 + CDC
 * art. 30) e não há volta.
 *
 * Os esportes do card fixam o ruleset (`escalacao_card_esporte`) — é essa linha
 * que torna estruturalmente impossível pontuar um atleta com uma versão de
 * manual que este card não adotou.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAdmin } from "@/lib/escalacao/queries";

const schema = z.object({
  modo: z.enum(["fixo", "mix"]),
  mes: z.string().regex(/^\d{4}-\d{2}-01$/, "mês precisa ser o 1º dia (YYYY-MM-01)"),
  titulo: z.string().min(3).max(120),
  competicao_id: z.string().uuid().nullable().optional(),
  n_titulares: z.number().int().min(1).max(30).default(10),
  n_reservas: z.number().int().min(0).max(10).default(2),
  teto_por_esporte: z.number().int().min(1).default(4),
  entrada_z: z.number().min(0).default(200),
  pontos_por_z: z.number().positive(),
  teto_emissao_z: z.number().min(0),
  abre_em: z.string().datetime(),
  fecha_em: z.string().datetime(),
  esportes: z
    .array(
      z.object({
        esporte_key: z.string(),
        regra_id: z.string().uuid(),
        fecha_em: z.string().datetime().nullable().optional(),
        evento_key: z.string().nullable().optional(),
      })
    )
    .min(1, "o card precisa de pelo menos um esporte"),
});

export async function POST(request: Request) {
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { esportes, ...card } = parsed.data;

  if (new Date(card.abre_em) >= new Date(card.fecha_em)) {
    return NextResponse.json({ error: "abre_em precisa ser antes de fecha_em" }, { status: 400 });
  }
  if (card.modo === "fixo" && !card.competicao_id) {
    return NextResponse.json({ error: "modo fixo exige uma competição" }, { status: 400 });
  }

  const { admin } = guarda;
  const { data: criado, error } = await admin
    .from("escalacao_card")
    .insert({ ...card, competicao_id: card.modo === "mix" ? null : card.competicao_id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: erroEsportes } = await admin
    .from("escalacao_card_esporte")
    .insert(esportes.map((e) => ({ ...e, card_id: criado.id })));
  if (erroEsportes) {
    // Card sem esporte é inútil e vira lixo silencioso no painel. Como ainda
    // está em rascunho e não tem pool nem time, apagar é seguro.
    await admin.from("escalacao_card").delete().eq("id", criado.id);
    return NextResponse.json({ error: erroEsportes.message }, { status: 400 });
  }

  revalidatePath("/admin/escalacao");
  return NextResponse.json({ success: true, id: criado.id });
}
