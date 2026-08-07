/**
 * POST /api/escalacao/inscrever — debita a entrada e inscreve o time.
 *
 * É o único ponto da superfície do usuário que move Z$. Toda a lógica de
 * dinheiro (lock do card, validação da composição ANTES do débito, débito
 * condicional, transaction, contabilidade em escalacao_emissao) está na RPC
 * `escalacao_inscrever` — aqui só entra sessão, flag e tradução do motivo.
 *
 * O débito é na inscrição, não no fechamento: o Art. 16 manda debitar "no
 * encerramento da Convocação", o que exigiria um lote disparado por cron, e os
 * crons do Zafe nunca dispararam (docs/audits/CRONS-NAO-DISPARAM.md). O time
 * seria inscrito de graça. O artigo precisa ser emendado antes de publicar.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { ESCALACAO_ENABLED } from "@/lib/flags";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const schema = z.object({ card_id: z.string().uuid() });

const MOTIVOS: Record<string, string> = {
  not_found: "Convocação não encontrada",
  closed: "A Convocação já fechou",
  no_team: "Monte e salve a escalação antes de inscrever",
  already_joined: "Você já está inscrito nesta Convocação",
  insufficient: "Saldo de Z$ insuficiente",
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
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const { data, error } = await createAdminClient().rpc("escalacao_inscrever", {
    p_user: user.id,
    p_card: parsed.data.card_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const r = data as { ok: boolean; reason?: string; detail?: string; entrada?: number };
  if (!r.ok) {
    const msg =
      r.reason === "invalid_lineup"
        ? (r.detail ?? "").replace(/^escalacao: /, "") || "Escalação incompleta"
        : (MOTIVOS[r.reason ?? ""] ?? "Não foi possível inscrever");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ success: true, entrada: r.entrada });
}
