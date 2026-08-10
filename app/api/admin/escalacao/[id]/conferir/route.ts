/**
 * GET /api/admin/escalacao/[id]/conferir — o que está inscrito, quanto pontuou
 * e quanto isso emite em Z$.
 *
 * GET porque não escreve nada: é a leitura que precede o pagamento, que é
 * irreversível. Fica separada de `recalcular` de propósito — recalcular grava.
 */
import { NextResponse } from "next/server";

import { conferirCard } from "@/lib/escalacao/conferencia";
import { exigirAdmin } from "@/lib/escalacao/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: cardId } = await params;
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;

  try {
    return NextResponse.json(await conferirCard(guarda.admin, cardId));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao conferir" },
      { status: 400 }
    );
  }
}
