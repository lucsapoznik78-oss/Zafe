/**
 * POST /api/escalacao/time — grava a escalação inteira.
 *
 * Gravar é de graça e reversível: o débito só acontece em /inscrever. Depois de
 * inscrito o time continua editável até `fecha_em` (Art. 7 §3) — quem congela é
 * o trigger T2 no banco, não esta rota.
 *
 * O trabalho todo é da RPC `escalacao_salvar_time`, porque trocar a escalação
 * exige DELETE + INSERT na MESMA transação (ver 077).
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { ESCALACAO_ENABLED } from "@/lib/flags";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const schema = z.object({
  card_id: z.string().uuid(),
  nome: z.string().trim().max(40).optional(),
  titulares: z.array(z.string().uuid()).max(30),
  reservas: z.array(z.string().uuid()).max(10),
});

const MOTIVOS: Record<string, string> = {
  not_found: "Convocação não encontrada",
  closed: "A Convocação já fechou",
  too_many: "Escalação maior que esta Convocação permite",
  duplicate: "Atleta repetido na escalação",
};

export async function POST(request: Request) {
  if (!ESCALACAO_ENABLED) {
    return NextResponse.json({ error: "Modo indisponível" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Escalação inválida" }, { status: 400 });
  }
  const { card_id, nome, titulares, reservas } = parsed.data;

  const { data, error } = await createAdminClient().rpc("escalacao_salvar_time", {
    p_user: user.id,
    p_card: card_id,
    p_nome: nome ?? null,
    p_titulares: titulares,
    p_reservas: reservas,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const r = data as { ok: boolean; reason?: string; detail?: string; completo?: boolean };
  if (!r.ok) {
    const msg =
      r.reason === "invalid_lineup"
        ? (r.detail ?? "").replace(/^escalacao: /, "") || "Escalação inválida"
        : (MOTIVOS[r.reason ?? ""] ?? "Não foi possível salvar");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ success: true, completo: r.completo });
}
