/**
 * POST /api/admin/escalacao/[id]/pagar — emite os Z$ do card.
 *
 * É a única ação irreversível do módulo, e o único lugar da plataforma que
 * CRIA Z$ do nada. Por isso o corpo exige `confirmacao_z`: o admin digita o
 * número que está vendo na conferência e o servidor recomputa esse mesmo
 * número antes de chamar a RPC. Se os dois discordam, alguma coisa mudou entre
 * olhar e clicar — um stat corrigido, um recálculo em outra aba, um time
 * inscrito no último segundo — e o pagamento é recusado em vez de emitir um
 * valor que ninguém aprovou.
 *
 * A trava é dupla de propósito: o teto de emissão também é verificado dentro de
 * `escalacao_pagar_card()`, sob `FOR UPDATE`. Esta camada existe para dar erro
 * legível; a do banco existe para ser verdade.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { conferirCard } from "@/lib/escalacao/conferencia";
import { exigirAdmin } from "@/lib/escalacao/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  confirmacao_z: z.number().nonnegative(),
});

const MOTIVOS: Record<string, string> = {
  not_found: "Card não encontrado",
  not_apurado: "O card precisa estar apurado antes de pagar",
  already_paid: "Este card já foi pago",
  teto_emissao: "A emissão estoura o teto do card — o pagamento foi recusado inteiro",
};

export async function POST(request: Request, { params }: RouteParams) {
  const { id: cardId } = await params;
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;
  const { admin } = guarda;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let conferencia;
  try {
    conferencia = await conferirCard(admin, cardId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao conferir" },
      { status: 400 }
    );
  }

  const esperado = conferencia.totais.z_a_emitir;
  if (Math.abs(esperado - parsed.data.confirmacao_z) > 0.005) {
    return NextResponse.json(
      {
        error:
          `O valor mudou desde a conferência: você confirmou ${parsed.data.confirmacao_z} Z$ ` +
          `e o card emite ${esperado} Z$ agora. Confira de novo antes de pagar.`,
        z_a_emitir: esperado,
      },
      { status: 409 }
    );
  }

  const { data, error } = await admin.rpc("escalacao_pagar_card", { p_card: cardId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const resultado = data as { ok: boolean; reason?: string; times?: number; z_emitido?: number };
  if (!resultado?.ok) {
    return NextResponse.json(
      { error: MOTIVOS[resultado?.reason ?? ""] ?? resultado?.reason ?? "Pagamento recusado" },
      { status: 400 }
    );
  }

  revalidatePath(`/admin/escalacao/${cardId}`);
  revalidatePath(`/admin/escalacao/${cardId}/times`);
  revalidatePath("/escalacao");

  return NextResponse.json({ success: true, ...resultado });
}
