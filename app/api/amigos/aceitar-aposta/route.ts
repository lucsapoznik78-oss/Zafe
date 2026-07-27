import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { debitBalance, creditBalance } from "@/lib/wallet";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Admin client obrigatório aqui: este fluxo mexe na carteira do CONVIDANTE,
  // e o RLS de wallets (auth.uid() = user_id) barra tanto a leitura quanto o
  // débito da carteira de outro usuário — com o client do usuário a rota
  // falhava sempre. A autorização está garantida pelo filtro do convite abaixo
  // (invitee_id = user.id AND status = 'pending').
  const admin = createAdminClient();

  const { invite_id } = await request.json();

  const { data: invite } = await admin
    .from("private_bet_invites")
    .select("*")
    .eq("id", invite_id)
    .eq("invitee_id", user.id)
    .eq("status", "pending")
    .single();

  if (!invite) return NextResponse.json({ error: "Convite inválido" }, { status: 400 });
  if (new Date(invite.expires_at) < new Date()) {
    await admin.from("private_bet_invites").update({ status: "expired" }).eq("id", invite_id);
    return NextResponse.json({ error: "Convite expirado" }, { status: 400 });
  }

  // Verificar saldo do invitee
  const { data: wallet } = await admin.from("wallets").select("balance").eq("user_id", user.id).single();
  if (!wallet || wallet.balance < invite.amount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Verificar saldo do inviter
  const { data: inviterWallet } = await admin.from("wallets").select("balance").eq("user_id", invite.inviter_id).single();
  if (!inviterWallet || inviterWallet.balance < invite.amount) {
    return NextResponse.json({ error: "Invitante sem saldo suficiente" }, { status: 400 });
  }

  // Debitar ambos os saldos de forma atômica ANTES de criar as apostas.
  // Se o segundo débito falhar, reverte o primeiro para não reter Z$.
  const inviterDebit = await debitBalance(admin, invite.inviter_id, invite.amount);
  if (!inviterDebit.ok) {
    return NextResponse.json(
      { error: inviterDebit.reason === "insufficient" ? "Invitante sem saldo suficiente" : "Erro ao debitar saldo. Tente novamente." },
      { status: inviterDebit.reason === "insufficient" ? 400 : 409 },
    );
  }
  const inviteeDebit = await debitBalance(admin, user.id, invite.amount);
  if (!inviteeDebit.ok) {
    await creditBalance(admin, invite.inviter_id, invite.amount);
    return NextResponse.json(
      { error: inviteeDebit.reason === "insufficient" ? "Saldo insuficiente" : "Erro ao debitar saldo. Tente novamente." },
      { status: inviteeDebit.reason === "insufficient" ? 400 : 409 },
    );
  }

  // Criar apostas privadas
  const [{ data: inviterBet }, { data: inviteeBet }] = await Promise.all([
    admin.from("bets").insert({
      topic_id: invite.topic_id, user_id: invite.inviter_id,
      side: invite.inviter_side, amount: invite.amount,
      status: "matched", matched_amount: invite.amount, unmatched_amount: 0,
      potential_payout: invite.amount * 2, is_private: true,
    }).select().single(),
    admin.from("bets").insert({
      topic_id: invite.topic_id, user_id: user.id,
      side: invite.invitee_side, amount: invite.amount,
      status: "matched", matched_amount: invite.amount, unmatched_amount: 0,
      potential_payout: invite.amount * 2, is_private: true,
    }).select().single(),
  ]);

  // Criar bet_match direto
  if (inviterBet && inviteeBet) {
    const simBetId = invite.inviter_side === "sim" ? inviterBet.id : inviteeBet.id;
    const naoBetId = invite.inviter_side === "nao" ? inviterBet.id : inviteeBet.id;
    await admin.from("bet_matches").insert({
      topic_id: invite.topic_id, sim_bet_id: simBetId, nao_bet_id: naoBetId,
      matched_amount: invite.amount,
    });
  }

  // (saldos de ambos já debitados de forma atômica acima)

  await admin.from("private_bet_invites").update({ status: "accepted" }).eq("id", invite_id);

  await admin.from("notifications").insert({
    user_id: invite.inviter_id,
    type: "bet_matched",
    payload: { topic_id: invite.topic_id, invitee_id: user.id },
    read: false,
  });

  return NextResponse.json({ success: true });
}
