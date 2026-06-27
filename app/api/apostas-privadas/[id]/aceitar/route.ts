import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { debitBalance } from "@/lib/wallet";
import { verificarLimiteAnual } from "@/lib/limits/private-bet-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const admin = createAdminClient();

  // Verificar convite pendente
  const { data: participant, error: pErr } = await supabase
    .from("topic_participants")
    .select("*")
    .eq("topic_id", topicId)
    .eq("user_id", user.id)
    .single();

  if (pErr || !participant) return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  if (participant.status !== "invited") return NextResponse.json({ error: "Convite já processado" }, { status: 400 });

  const { data: topicCreator } = await admin
    .from("topics")
    .select("creator_id, min_bet, title")
    .eq("id", topicId)
    .single();

  if (!topicCreator) return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });

  const isJudge = participant.side === "J";

  // ── Claim atômico do convite (audit N9) ──────────────────────────────
  // O UPDATE guardado por status='invited' + .select() é o ponto de
  // serialização: dois aceites concorrentes passavam ambos pela leitura
  // acima e dobravam débito + aposta. Agora só um vence o claim.
  const { data: claimed } = await admin
    .from("topic_participants")
    .update({ status: "accepted", joined_at: new Date().toISOString() })
    .eq("topic_id", topicId)
    .eq("user_id", user.id)
    .eq("status", "invited")
    .select("user_id");

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "Convite já processado" }, { status: 400 });
  }

  const revertClaim = () =>
    admin
      .from("topic_participants")
      .update({ status: "invited", joined_at: null })
      .eq("topic_id", topicId)
      .eq("user_id", user.id)
      .eq("status", "accepted");

  if (!isJudge) {
    // Verificar saldo para participantes apostadores
    const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
    const betAmount = topicCreator.min_bet;
    if (!wallet || wallet.balance < betAmount) {
      await revertClaim();
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    }

    // Verificar limite anual Z$ por par de usuários (Lei 14.790/2023, Art. 49)
    const limite = await verificarLimiteAnual(admin, user.id, topicCreator.creator_id, betAmount);
    if (!limite.ok) {
      await revertClaim();
      return NextResponse.json({ error: limite.mensagem }, { status: 400 });
    }

    // Debitar saldo de forma atômica ANTES de registrar a aposta, para que uma
    // corrida perdida não crie aposta sem o débito correspondente.
    const debit = await debitBalance(admin, user.id, betAmount);
    if (!debit.ok) {
      await revertClaim();
      return NextResponse.json(
        { error: debit.reason === "insufficient" ? "Saldo insuficiente" : "Erro ao debitar saldo. Tente novamente." },
        { status: debit.reason === "insufficient" ? 400 : 409 },
      );
    }

    // Criar aposta mínima (saldo já debitado acima)
    const betSide = participant.side === "A" ? "sim" : "nao";
    await admin.from("bets").insert({
      topic_id: topicId, user_id: user.id,
      side: betSide, amount: betAmount,
      status: "pending", matched_amount: betAmount, unmatched_amount: 0,
      is_private: true,
    });

    await admin.from("transactions").insert({
      user_id: user.id, type: "bet_placed",
      amount: betAmount, net_amount: betAmount,
      description: `Bolão — ${topicCreator.title?.slice(0, 40)}`,
      reference_id: topicId,
    });
  }
  // Juiz: o claim acima já marcou como aceito, sem apostar.

  // ── Verificar se topic deve ativar (juiz aceito + ≥1 adversário aceito) ──
  const { data: accepted } = await admin
    .from("topic_participants")
    .select("side, status")
    .eq("topic_id", topicId)
    .eq("status", "accepted");

  const judgeAccepted = (accepted ?? []).some((p) => p.side === "J");
  const adversaryAccepted = (accepted ?? []).some((p) => p.side === "B");

  if (judgeAccepted && adversaryAccepted) {
    await admin.from("topics").update({ status: "active" }).eq("id", topicId).eq("status", "pending");
  }

  return NextResponse.json({ success: true });
}
