import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { invitee_id, topic_id, inviter_side, amount } = await request.json();

  if (!invitee_id || !topic_id || !inviter_side || !amount) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Verificar saldo do inviter
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet || wallet.balance < amount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  const inviteesSide = inviter_side === "sim" ? "nao" : "sim";
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("private_bet_invites").insert({
    topic_id,
    inviter_id: user.id,
    invitee_id,
    inviter_side,
    invitee_side: inviteesSide,
    amount,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) return NextResponse.json({ error: "Erro ao criar convite" }, { status: 500 });

  await supabase.from("notifications").insert({
    user_id: invitee_id,
    type: "bet_invite",
    payload: { inviter_id: user.id, topic_id, amount },
    read: false,
  });

  return NextResponse.json({ success: true });
}
