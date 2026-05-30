import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const CONTESTATION_FEE = 10;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { reason } = await request.json();
  if (!reason || reason.length < 10 || reason.length > 500) {
    return NextResponse.json({ error: "Motivo deve ter entre 10 e 500 caracteres" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: event } = await admin
    .from("community_events")
    .select("status, creator_id, resolved_at")
    .eq("id", params.id)
    .single();

  if (!event || event.status !== "community_resolved") {
    return NextResponse.json({ error: "Este evento não está em fase de contestação" }, { status: 400 });
  }

  // Check 48h window
  const resolvedAt = new Date(event.resolved_at);
  const deadline = new Date(resolvedAt.getTime() + 48 * 3600000);
  if (new Date() > deadline) {
    return NextResponse.json({ error: "O prazo de contestação expirou" }, { status: 400 });
  }

  // Must be a participant
  const { data: userBet } = await admin
    .from("community_bets")
    .select("id")
    .eq("event_id", params.id)
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!userBet) {
    return NextResponse.json({ error: "Apenas participantes podem contestar" }, { status: 403 });
  }

  // Already contested?
  const { data: existing } = await admin
    .from("community_contestations")
    .select("id")
    .eq("event_id", params.id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Você já contestou este evento" }, { status: 400 });
  }

  // Charge fee
  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  if (!wallet || wallet.balance < CONTESTATION_FEE) {
    return NextResponse.json({ error: `Saldo insuficiente. Taxa de contestação: Z$ ${CONTESTATION_FEE}` }, { status: 400 });
  }

  await admin.from("wallets").update({ balance: wallet.balance - CONTESTATION_FEE }).eq("user_id", user.id);
  await admin.from("transactions").insert({
    user_id: user.id,
    type: "commission",
    amount: CONTESTATION_FEE,
    net_amount: CONTESTATION_FEE,
    description: "Taxa de contestação — Comunidade",
    reference_id: params.id,
  });

  await admin.from("community_contestations").insert({
    event_id: params.id,
    user_id: user.id,
    reason,
    fee_charged: CONTESTATION_FEE,
  });

  // Update count
  const { count } = await admin
    .from("community_contestations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", params.id);

  await admin
    .from("community_events")
    .update({ contestation_count: count ?? 1 })
    .eq("id", params.id);

  // Check if 30% threshold reached
  const { data: ev } = await admin
    .from("community_events")
    .select("participant_count")
    .eq("id", params.id)
    .single();

  const participantCount = ev?.participant_count ?? 1;
  const threshold = Math.max(2, Math.ceil(participantCount * 0.3));

  if ((count ?? 0) >= threshold) {
    await admin
      .from("community_events")
      .update({ status: "contested" })
      .eq("id", params.id);
  }

  return NextResponse.json({ success: true, contestation_count: count });
}
