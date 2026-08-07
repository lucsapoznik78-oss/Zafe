/**
 * POST /api/admin/escalacao/[id]/publicar — tira o card do rascunho.
 *
 * É um ato de mão única: a partir daqui o trigger T6 congela preço, tamanho de
 * time, teto e prazo (Art. 33 + CDC art. 30). O usuário passa a ver o card e o
 * pool, e o que ele aceitou ao se inscrever não muda mais.
 *
 * Só publica card que já tem esporte e pool — publicar um card vazio abriria
 * uma Convocação em que ninguém consegue escalar ninguém.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { exigirAdmin } from "@/lib/escalacao/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id: cardId } = await params;
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;
  const { admin } = guarda;

  const { data: card } = await admin
    .from("escalacao_card")
    .select("id, status, n_titulares, fecha_em")
    .eq("id", cardId)
    .single();
  if (!card) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });
  if (card.status !== "rascunho") {
    return NextResponse.json({ error: "Este card já foi publicado" }, { status: 400 });
  }
  if (new Date(card.fecha_em) <= new Date()) {
    return NextResponse.json({ error: "O prazo deste card já passou" }, { status: 400 });
  }

  const { count } = await admin
    .from("escalacao_card_atleta")
    .select("id", { count: "exact", head: true })
    .eq("card_id", cardId);
  if (!count || count < card.n_titulares) {
    return NextResponse.json(
      { error: `Pool tem ${count ?? 0} atletas e o time exige ${card.n_titulares} titulares` },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("escalacao_card")
    .update({ status: "aberto", publicado_em: new Date().toISOString() })
    .eq("id", cardId)
    .eq("status", "rascunho");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidatePath("/admin/escalacao");
  revalidatePath(`/admin/escalacao/${cardId}`);
  return NextResponse.json({ success: true });
}
