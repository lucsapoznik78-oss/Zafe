/**
 * Payout logic para Desafios
 * Distribuição: 6% criador + 6% Zafe + resto proporcional aos vencedores
 */
import { sendPushToUser } from "@/lib/webpush";

/**
 * Notifica todos os apostadores que o resultado foi definido e a janela de contestação abriu.
 * Chamado quando desafio passa para under_contestation (por IA ou por prova aprovada).
 */
export async function notificarContestacao(
  supabase: any,
  desafioId: string,
  desafioTitle: string,
  resolution: "sim" | "nao",
  contestDeadlineAt: string
) {
  const { data: bets } = await supabase
    .from("desafio_bets")
    .select("user_id")
    .eq("desafio_id", desafioId)
    .not("status", "in", '("refunded","won","lost")');

  if (!bets?.length) return;

  const title = desafioTitle.slice(0, 55);
  const prazo = new Date(contestDeadlineAt).toLocaleString("pt-BR");

  // Deduplica user_ids
  const userIds = [...new Set((bets as any[]).map((b) => b.user_id))];

  await Promise.allSettled(
    userIds.map((userId) =>
      supabase.from("notifications").insert({
        user_id: userId,
        type: "market_resolved",
        title: `Resultado: ${resolution.toUpperCase()}`,
        body: `"${title}" foi decidido como ${resolution.toUpperCase()}. Você tem até ${prazo} para contestar.`,
        data: { desafio_id: desafioId, resolution },
      })
    )
  );

  // Push para todos
  await Promise.allSettled(
    userIds.map((userId) =>
      sendPushToUser(supabase, userId, {
        title: `Desafio: ${resolution.toUpperCase()}`,
        body: `"${title}" → ${resolution.toUpperCase()}. Conteste até ${prazo}.`,
        url: `/desafios/${desafioId}`,
      })
    )
  );
}

function fmt(v: number) {
  return "Z$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CREATOR_FEE_RATE = 0.06;
const PLATFORM_FEE_RATE = 0.06;
const TOTAL_FEE_RATE = CREATOR_FEE_RATE + PLATFORM_FEE_RATE;

export async function pagarDesafio(
  supabase: any,
  desafioId: string,
  resolution: "sim" | "nao",
  resolvedBy: "oracle" | "creator" | "admin"
) {
  const { data: desafio } = await supabase
    .from("desafios")
    .select("title, creator_id")
    .eq("id", desafioId)
    .single();
  const title = desafio?.title?.slice(0, 55) ?? "Desafio";

  const { data: allBets } = await supabase
    .from("desafio_bets")
    .select("*")
    .eq("desafio_id", desafioId)
    .neq("status", "refunded");

  const bets = allBets ?? [];
  const winnerBets = bets.filter((b: any) => b.side === resolution);
  const loserBets = bets.filter((b: any) => b.side !== resolution);

  // Sem cobertura → reembolso total
  if (winnerBets.length === 0 || loserBets.length === 0) {
    await reembolsarDesafio(supabase, desafioId, "Sem apostas no lado oposto", resolvedBy);
    return { note: "no_coverage_refund" };
  }

  const totalWinPool = winnerBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
  const totalLosePool = loserBets.reduce((s: number, b: any) => s + parseFloat(b.amount), 0);
  const totalPool = totalWinPool + totalLosePool;

  // Taxas
  const creatorFee = parseFloat((totalPool * CREATOR_FEE_RATE).toFixed(2));
  const platformFee = parseFloat((totalPool * PLATFORM_FEE_RATE).toFixed(2));
  const distributablePool = totalPool - creatorFee - platformFee;

  // Pagar criador
  if (desafio?.creator_id) {
    const { data: cw } = await supabase
      .from("wallets").select("balance").eq("user_id", desafio.creator_id).single();
    await supabase.from("wallets")
      .update({ balance: parseFloat(((cw?.balance ?? 0) + creatorFee).toFixed(2)) })
      .eq("user_id", desafio.creator_id);
    await supabase.from("transactions").insert({
      user_id: desafio.creator_id, type: "commission", amount: creatorFee, net_amount: creatorFee,
      description: `Taxa de criador — "${title}" (6%)`, reference_id: desafioId,
    });
    await supabase.from("notifications").insert({
      user_id: desafio.creator_id, type: "market_resolved",
      title: "Taxa de criador recebida",
      body: `Seu desafio "${title}" foi resolvido! Você recebeu ${fmt(creatorFee)} (6%).`,
      data: { desafio_id: desafioId },
    });
  }

  // Pagar vencedores da parcela distribuível
  for (const bet of winnerBets) {
    const share = parseFloat(((bet.amount / totalWinPool) * distributablePool).toFixed(2));
    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", bet.user_id).single();
    await supabase.from("wallets")
      .update({ balance: parseFloat(((w?.balance ?? 0) + share).toFixed(2)) })
      .eq("user_id", bet.user_id);
    await supabase.from("desafio_bets")
      .update({ status: "won" }).eq("id", bet.id);
    await supabase.from("transactions").insert({
      user_id: bet.user_id, type: "bet_won", amount: share, net_amount: share,
      description: `Ganhou desafio — ${resolution.toUpperCase()} — "${title}"`, reference_id: desafioId,
    });
    await supabase.from("notifications").insert({
      user_id: bet.user_id, type: "bet_won",
      title: "Você ganhou! 🏆",
      body: `Seu ${resolution.toUpperCase()} em "${title}" rendeu ${fmt(share)}.`,
      data: { desafio_id: desafioId, payout: share },
    });
    sendPushToUser(supabase, bet.user_id, {
      title: "Você ganhou! 🏆",
      body: `Seu ${resolution.toUpperCase()} em "${title}" rendeu ${fmt(share)}.`,
      url: `/desafios/${desafioId}`,
    }).catch(() => {});
  }

  // Marcar perdedores
  for (const bet of loserBets) {
    await supabase.from("desafio_bets").update({ status: "lost" }).eq("id", bet.id);
    await supabase.from("notifications").insert({
      user_id: bet.user_id, type: "market_resolved",
      title: "Desafio resolvido",
      body: `"${title}" foi resolvido como ${resolution.toUpperCase()}. Boa sorte na próxima!`,
      data: { desafio_id: desafioId },
    });
  }

  await supabase.from("desafios").update({
    status: "resolved",
    resolution,
    resolved_at: new Date().toISOString(),
    resolved_by: resolvedBy,
    creator_fee_paid: true,
  }).eq("id", desafioId);

  return { note: "paid", creatorFee, platformFee };
}

export async function reembolsarDesafio(
  supabase: any,
  desafioId: string,
  motivo: string,
  resolvedBy?: string
) {
  const { data: desafio } = await supabase
    .from("desafios").select("title").eq("id", desafioId).single();
  const title = desafio?.title?.slice(0, 55) ?? "Desafio";

  const { data: bets } = await supabase
    .from("desafio_bets").select("*")
    .eq("desafio_id", desafioId).neq("status", "refunded");

  for (const bet of bets ?? []) {
    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", bet.user_id).single();
    await supabase.from("wallets")
      .update({ balance: parseFloat(((w?.balance ?? 0) + parseFloat(bet.amount)).toFixed(2)) })
      .eq("user_id", bet.user_id);
    await supabase.from("desafio_bets").update({ status: "refunded" }).eq("id", bet.id);
    await supabase.from("transactions").insert({
      user_id: bet.user_id, type: "bet_refund", amount: bet.amount, net_amount: bet.amount,
      description: `Reembolso desafio — ${motivo}`, reference_id: desafioId,
    });
    await supabase.from("notifications").insert({
      user_id: bet.user_id, type: "market_resolved",
      title: "Desafio reembolsado",
      body: `"${title}": ${motivo}. Reembolso de ${fmt(parseFloat(bet.amount))} creditado.`,
      data: { desafio_id: desafioId },
    });
  }

  await supabase.from("desafios").update({
    status: "resolved",
    resolution: null,
    resolved_at: new Date().toISOString(),
    ...(resolvedBy ? { resolved_by: resolvedBy } : {}),
  }).eq("id", desafioId);
}
