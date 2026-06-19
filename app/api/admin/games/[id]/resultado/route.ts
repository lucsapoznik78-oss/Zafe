import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyEventResult } from "@/lib/games/resolve";
import type { GamesEvent } from "@/lib/games/types";

// POST /api/admin/games/[id]/resultado — resolução manual do admin.
// Fallback quando o provedor não dá veredito confiável. Pontua o modo grátis
// (idempotente) e liquida o pote (games_pot_settle, idempotente). Não confia
// no client: vencedor validado pelo zod e evento relido do banco.

const bodySchema = z.object({
  winner: z.enum(["a", "b"]),
  source_url: z.string().url().nullish(),
});

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin === true ? user : null;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Resultado inválido" },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("games_event")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!event) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }
  const e = event as GamesEvent;

  if (e.status === "cancelled") {
    return NextResponse.json({ error: "Evento cancelado não pontua" }, { status: 400 });
  }
  if (new Date(e.starts_at).getTime() > Date.now()) {
    return NextResponse.json({ error: "O evento ainda não começou" }, { status: 400 });
  }
  // Resolução é forward-only: pote (games_pot_settle) e pontuação são idempotentes
  // mas NÃO reversíveis. Reabrir um evento já finalizado mente "sucesso" no pote
  // (no-op) e dupla-conta pontos no grátis. Bloqueia explicitamente.
  if (e.status === "finished") {
    return NextResponse.json(
      { error: "Evento já resolvido — o resultado não pode ser alterado" },
      { status: 409 }
    );
  }

  const result = await applyEventResult(admin, e, body.winner, body.source_url ?? null);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Erro ao aplicar resultado" }, { status: 500 });
  }

  await admin.from("games_resolution_log").insert({
    event_id: e.id,
    attempt: 1,
    provider: "manual",
    raw_response: JSON.stringify({ manual: true, by: user.id, winner: body.winner }),
    parsed: body,
    confidence: null,
    source_url: body.source_url ?? null,
    outcome: "applied",
  });

  return NextResponse.json({ success: true });
}
