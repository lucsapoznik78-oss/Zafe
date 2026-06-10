import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCompetition } from "@/lib/copa/queries";
import { sendPushToUser } from "@/lib/webpush";

// POST /api/admin/copa/finalizar — encerra a Zafe Copa e paga o pote.
// Pre-flight: TODAS as partidas em estado terminal (finished/void).
// copa_payout é uma transação única com guarda CAS (pot_paid_at IS NULL)
// → double-click/retry nunca paga 2x. Conservação de Z$:
// SUM(transactions copa_buy_in) + SUM(copa_prize) = 0.

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

export async function POST() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const competition = await getCompetition(admin);
  if (!competition) {
    return NextResponse.json({ error: "Competição não encontrada" }, { status: 404 });
  }
  if (!["open", "running", "finished"].includes(competition.status)) {
    return NextResponse.json({ error: "Competição já encerrada" }, { status: 400 });
  }

  // Pre-flight: nenhuma partida pendente (partida adiada indefinidamente
  // precisa ser anulada pelo admin antes do payout).
  const { count: pending } = await admin
    .from("copa_matches")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competition.id)
    .not("status", "in", "(finished,void)");
  if ((pending ?? 0) > 0) {
    return NextResponse.json(
      { error: `Ainda há ${pending} partida(s) sem resultado (resolva ou anule antes de finalizar)` },
      { status: 400 }
    );
  }

  if (competition.status !== "finished") {
    const { error } = await admin
      .from("copa_competition")
      .update({ status: "finished" })
      .eq("id", competition.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data, error } = await admin.rpc("copa_payout", {
    p_competition: competition.id,
  });
  if (error) {
    console.error("[admin/copa/finalizar]", error);
    return NextResponse.json({ error: "Erro ao pagar a premiação" }, { status: 500 });
  }
  if (!data?.ok) {
    return NextResponse.json(
      { error: data?.reason === "no_participants" ? "Sem participantes" : "Premiação já paga" },
      { status: 400 }
    );
  }

  // Notificação ao vencedor (não bloqueante, padrão do repo)
  const title = "Você venceu a Zafe Copa 2026!";
  const body = `Parabéns! Z$ ${Number(data.pot_total).toLocaleString("pt-BR")} foram creditados na sua carteira.`;
  await Promise.allSettled([
    admin.from("notifications").insert({
      user_id: data.winner_user_id,
      type: "bet_won",
      title,
      body,
      data: { copa_competition_id: competition.id },
    }),
    sendPushToUser(admin, data.winner_user_id, { title, body, url: "/copa" }),
  ]);

  return NextResponse.json({
    success: true,
    winner_user_id: data.winner_user_id,
    pot_total: data.pot_total,
  });
}
