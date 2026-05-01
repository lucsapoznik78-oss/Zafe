import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calcOdds } from "@/lib/odds";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { topic_id, side, amount } = await request.json();

  if (!topic_id || !side || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }
  if (side !== "sim" && side !== "nao") {
    return NextResponse.json({ error: "Lado inválido" }, { status: 400 });
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
      .select("id, status, closes_at").eq("id", topic_id).single(),
  ]);

  if (!inscricao) {
    return NextResponse.json({ error: "Inscreva-se no concurso primeiro" }, { status: 403 });
  }
  if (!wallet || wallet.balance < Number(amount)) {
    return NextResponse.json({ error: `Saldo ZC$ insuficiente. Você tem ZC$ ${wallet?.balance ?? 0}.` }, { status: 400 });
  }
  if (!topic || topic.status !== "active" || new Date(topic.closes_at) < new Date()) {
    return NextResponse.json({ error: "Este evento não está disponível" }, { status: 400 });
  }

  // Calcula odds estimadas com base no pool do concurso para este tópico
  const { data: existingBets } = await admin
    .from("concurso_bets")
    .select("side, amount")
    .eq("topic_id", topic_id)
    .eq("concurso_id", concurso.id)
    .eq("status", "matched");

  const poolSim = (existingBets ?? []).filter((b: any) => b.side === "sim").reduce((s: number, b: any) => s + Number(b.amount), 0);
  const poolNao = (existingBets ?? []).filter((b: any) => b.side === "nao").reduce((s: number, b: any) => s + Number(b.amount), 0);
  const { simOdds, naoOdds } = calcOdds(poolSim, poolNao);
  const estimatedOdds = side === "sim" ? simOdds : naoOdds;
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

  const { error: betError } = await admin.from("concurso_bets").insert({
    user_id: user.id,
    concurso_id: concurso.id,
    topic_id,
    side,
    amount: Number(amount),
    potential_payout: potentialPayout,
    status: "matched",
  });

  if (betError) {
    // Rollback
    await admin.from("concurso_wallets")
      .update({ balance: wallet.balance, updated_at: now })
      .eq("user_id", user.id).eq("concurso_id", concurso.id);
    return NextResponse.json({ error: betError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, estimated_odds: estimatedOdds });
}
