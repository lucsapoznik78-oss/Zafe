/**
 * POST /api/admin/escalacao/[id]/recalcular — recomputa a apuração do card.
 *
 * Recalcular é REVERSÍVEL (roda quantas vezes for preciso, sempre do zero) e
 * por isso vive num endpoint próprio, longe de `escalacao_pagar_card()`, que
 * não é. Nunca juntar os dois num botão só.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { apurarCard } from "@/lib/escalacao/apuracao";
import { exigirAdmin } from "@/lib/escalacao/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id: cardId } = await params;
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;

  try {
    const resultado = await apurarCard(guarda.admin, cardId);
    revalidatePath(`/admin/escalacao/${cardId}`);
    revalidatePath(`/admin/escalacao/${cardId}/apuracao`);
    return NextResponse.json({ success: true, ...resultado });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao apurar" },
      { status: 400 }
    );
  }
}
