/**
 * POST /api/admin/escalacao/[id]/reembolsar — cancela o card e devolve a
 * entrada de todo mundo.
 *
 * O Art. 16 §3 só cobre "o atleta não competiu" (sem devolução); não há regra
 * para "o card inteiro foi cancelado". Enquanto o regulamento não tem o artigo,
 * o código adota devolução integral — é a única leitura defensável pelo CDC
 * para um serviço prometido e não prestado.
 *
 * Diferente de pagar, isto não emite Z$: só desfaz o débito da inscrição. Ainda
 * assim exige confirmação digitada, porque é de mão única (o card vira
 * `cancelado` e ninguém mais se inscreve).
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAdmin } from "@/lib/escalacao/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  confirmacao: z.literal("CANCELAR"),
});

export async function POST(request: Request, { params }: RouteParams) {
  const { id: cardId } = await params;
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmação inválida" }, { status: 400 });
  }

  const { data, error } = await guarda.admin.rpc("escalacao_reembolsar_card", { p_card: cardId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const resultado = data as {
    ok: boolean;
    reason?: string;
    reembolsados?: number;
    z_devolvido?: number;
  };
  if (!resultado?.ok) {
    return NextResponse.json(
      {
        error:
          resultado?.reason === "already_settled"
            ? "Este card já foi pago ou cancelado"
            : (resultado?.reason ?? "Reembolso recusado"),
      },
      { status: 400 }
    );
  }

  revalidatePath(`/admin/escalacao/${cardId}`);
  revalidatePath(`/admin/escalacao/${cardId}/times`);
  revalidatePath("/escalacao");

  return NextResponse.json({ success: true, ...resultado });
}
