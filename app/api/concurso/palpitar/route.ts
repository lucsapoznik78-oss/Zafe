import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calcOdds } from "@/lib/odds";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { topic_id, side, outcome_id, amount } = await request.json();

  if (!topic_id || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: concurso } = await admin
    .from("concursos")
    .select("id")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  if (!concurso) {
    return NextResponse.json({ error: "Nenhum concurso ativo" }, { status: 404 });
  }

  const [{ data: inscricao }, { data: wallet }, { data: topic }] = await Promise.all([
    admin.from("inscricoes_concurso")
      .select("id").eq("user_id", user.id).eq("concurso_id", concurso.id).single(),
    admin.from("concurso_wallets")
      .select("balance").eq("user_id", user.id).eq("concurso_id", concurso.id).single(),
    admin.from("topics")
      .select("id, status, closes_at, market_type").eq("id", topic_id).eq("concurso_id", concurso.id).single(),
  ]);

  const isMulti = topic?.market_type === "multi";

  if (!inscricao) {
    return NextResponse.json({ error: "Inscreva-se no concurso primeiro" }, { status: 403 });
  }
  if (!wallet || wallet.balance < Number(amount)) {
    return NextResponse.json({ error: `Saldo insuficiente. Você tem Z$ ${wallet?.balance ?? 0} no concurso.` }, { status: 400 });
  }
  if (!topic || topic.status !== "active" || new Date(topic.closes_at) < new Date()) {
    return NextResponse.json({ error: "Este evento não está disponível" }, { status: 400 });
  }

  // Validação específica por tipo de mercado
  if (isMulti && !outcome_id) {
    return NextResponse.json({ error: "Selecione um resultado" }, { status: 400 });
  }
  if (!isMulti && side !== "sim" && side !== "nao") {
    return NextResponse.json({ error: "Lado inválido" }, { status: 400 });
  }

  // Calcula odds estimadas
  let estimatedOdds = 1;
  if (isMulti) {
    const { data: outcomes } = await admin
      .from("topic_outcomes").select("id, pool").eq("topic_id", topic_id);
    const totalPool = (outcomes ?? []).reduce((s: number, o: any) => s + Number(o.pool), 0) + Number(amount);
    const outcomePool = ((outcomes ?? []).find((o: any) => o.id === outcome_id)?.pool ?? 0) + Number(amount);
    estimatedOdds = outcomePool > 0 ? totalPool / outcomePool : 1;
  } else {
    const { data: existingBets } = await admin
      .from("concurso_bets").select("side, amount")
      .eq("topic_id", topic_id).eq("concurso_id", concurso.id).eq("status", "matched");
    const poolSim = (existingBets ?? []).filter((b: any) => b.side === "sim").reduce((s: number, b: any) => s + Number(b.amount), 0);
    const poolNao = (existingBets ?? []).filter((b: any) => b.side === "nao").reduce((s: number, b: any) => s + Number(b.amount), 0);
    const { simOdds, naoOdds } = calcOdds(poolSim, poolNao);
    estimatedOdds = side === "sim" ? simOdds : naoOdds;
  }

  const potentialPayout = Number(amount) * estimatedOdds;

  // Debita a carteira (lock otimista — só debita se balance >= amount)
  const { error: debitError, count } = await admin
    .from("concurso_wallets")
    .update({ balance: wallet.balance - Number(amount), updated_at: now })
    .eq("user_id", user.id)
    .eq("concurso_id", concurso.id)
    .gte("balance", Number(amount));

  if (debitError || count === 0) {
    return NextResponse.json({ error: "Falha ao debitar saldo" }, { status: 500 });
  }

  const betPayload: Record<string, any> = {
    user_id: user.id,
    concurso_id: concurso.id,
    topic_id,
    amount: Number(amount),
    potential_payout: potentialPayout,
    status: "matched",
  };
  if (isMulti) { betPayload.outcome_id = outcome_id; }
  else { betPayload.side = side; }

  const { error: betError } = await admin.from("concurso_bets").insert(betPayload);

  if (betError) {
    // Rollback
    await admin.from("concurso_wallets")
      .update({ balance: wallet.balance, updated_at: now })
      .eq("user_id", user.id).eq("concurso_id", concurso.id);
    return NextResponse.json({ error: betError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, estimated_odds: estimatedOdds });
}
