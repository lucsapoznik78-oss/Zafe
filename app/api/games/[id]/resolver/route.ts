import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyEventResult } from "@/lib/games/resolve";
import type { GamesEvent } from "@/lib/games/types";

// POST /api/games/[id]/resolver — o CRIADOR resolve seu próprio evento
// (estilo Comunidade). Só vale para eventos modo grátis criados pelo usuário:
// nenhum Z$ está em jogo, então o blast radius é só pontos/ranks. Eventos
// oficiais (creator_id NULL) e modo pote são resolvidos pelo cron/admin.

const bodySchema = z.object({ winner: z.enum(["a", "b"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Resultado inválido" }, { status: 400 });
  }
  const { winner } = parsed.data;

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("games_event")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  if (event.creator_id !== user.id) {
    return NextResponse.json({ error: "Só o criador resolve este evento" }, { status: 403 });
  }
  if (event.mode !== "free") {
    return NextResponse.json({ error: "Este evento não pode ser resolvido manualmente" }, { status: 400 });
  }
  if (event.status === "finished" || event.status === "cancelled") {
    return NextResponse.json(
      { error: "Evento já resolvido — o resultado não pode ser alterado" },
      { status: 409 }
    );
  }
  if (new Date(event.closes_at).getTime() > Date.now()) {
    return NextResponse.json({ error: "Aguarde o fechamento dos palpites" }, { status: 400 });
  }

  const result = await applyEventResult(admin, event as GamesEvent, winner, null);
  if (!result.ok) {
    console.error("[games/resolver]", id, result.error);
    return NextResponse.json({ error: "Erro ao resolver evento" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
