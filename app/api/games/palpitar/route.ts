import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { predictionInputSchema } from "@/lib/games/types";

// POST /api/games/palpitar — cria/edita palpite "Quem ganha?" de um evento.
// Regras validadas NO SERVIDOR (nunca confiar no client):
//  * autenticado
//  * só até o closes_at (re-lido do banco; lock automático depois)
//  * só evento 'scheduled'
//  * modo grátis: upsert simples (pode trocar enquanto aberto)
//  * modo pote: games_join_pot (débito Z$ atômico via SECURITY DEFINER);
//    não permite trocar depois que o stake entrou no pote.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = predictionInputSchema.safeParse({
    event_id: body?.event_id,
    pick: body?.pick,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Palpite inválido" },
      { status: 400 }
    );
  }
  const { event_id, pick } = parsed.data;

  const admin = createAdminClient();

  // Estado do evento vem do BANCO (modo, deadline, status) — não do body.
  const { data: event } = await admin
    .from("games_event")
    .select("id, mode, status, closes_at")
    .eq("id", event_id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }
  if (event.status !== "scheduled") {
    return NextResponse.json({ error: "Este evento não aceita palpites" }, { status: 400 });
  }
  if (new Date(event.closes_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Palpites encerrados: o evento já vai começar" },
      { status: 400 }
    );
  }

  if (event.mode === "pot") {
    // Débito Z$ + criação do palpite + soma ao pote, tudo atômico.
    const { data, error } = await admin.rpc("games_join_pot", {
      p_user: user.id,
      p_event: event.id,
      p_pick: pick,
    });
    if (error) {
      console.error("[games/palpitar/pot]", error);
      return NextResponse.json({ error: "Erro ao entrar no pote" }, { status: 500 });
    }
    const result = data as { ok: boolean; reason?: string } | null;
    if (!result?.ok) {
      const msg =
        result?.reason === "insufficient" ? "Saldo Z$ insuficiente" :
        result?.reason === "already_predicted" ? "Você já entrou neste pote" :
        result?.reason === "closed" ? "Palpites encerrados" :
        "Não foi possível registrar o palpite";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else {
    // Modo grátis: upsert do palpite, sem tocar na carteira.
    const { error } = await admin.from("games_prediction").upsert(
      {
        event_id: event.id,
        user_id: user.id,
        pick,
        buy_in_paid: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" }
    );
    if (error) {
      console.error("[games/palpitar/free]", error);
      return NextResponse.json({ error: "Erro ao salvar palpite" }, { status: 500 });
    }
  }

  revalidatePath("/games");
  revalidatePath(`/games/${event.id}`);
  return NextResponse.json({ success: true });
}
