import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { FATOR_DEVOLUCAO_SAIDA, TAXA_SAIDA_ANTECIPADA, CONTA_OPERACIONAL } from "@/lib/financeiro";

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id: betId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Buscar a aposta
  const { data: bet } = await supabase
    .from("bets")
    .select("id, user_id, topic_id, amount, status, side")
    .eq("id", betId)
    .single();

  if (!bet) return NextResponse.json({ error: "Aposta não encontrada" }, { status: 404 });
  if (bet.user_id !== user.id) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (!["pending", "matched"].includes(bet.status)) {
    return NextResponse.json({ error: "Só é possível sair de apostas ativas" }, { status: 400 });
  }

  // Verificar se o mercado ainda está aberto
  const { data: topic } = await supabase
    .from("topics")
    .select("status, closes_at, title")
    .eq("id", bet.topic_id)
    .single();

  if (!topic || topic.status !== "active") {
    return NextResponse.json({ error: "O mercado já encerrou — não é possível sair" }, { status: 400 });
  }
  if (new Date(topic.closes_at) < new Date()) {
    return NextResponse.json({ error: "O prazo do mercado já passou" }, { status: 400 });
  }

  const devolucao  = parseFloat((bet.amount * FATOR_DEVOLUCAO_SAIDA).toFixed(2));
  const comissao   = parseFloat((bet.amount * TAXA_SAIDA_ANTECIPADA).toFixed(2));

  // Devolver 96% ao usuário
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
  await supabase.from("wallets")
    .update({ balance: (wallet?.balance ?? 0) + devolucao })
    .eq("user_id", user.id);

  // Marcar aposta como encerrada antecipadamente
  await supabase.from("bets").update({ status: "exited" }).eq("id", betId);

  // Registrar a devolução
  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "bet_exited",
    amount: devolucao,
    net_amount: devolucao,
    description: `Saída antecipada — ${bet.side.toUpperCase()} em "${topic.title?.slice(0, 50)}"`,
    reference_id: bet.topic_id,
    // 4% de comissao vai para CONTA_OPERACIONAL — ver lib/financeiro.ts
  });

  // Registrar a comissão da saída antecipada (para controle do relatório financeiro)
  await supabase.from("transactions").insert({
    user_id: user.id,
    type: "exit_fee",
    amount: comissao,
    net_amount: comissao,
    description: `Taxa de saída antecipada (${(TAXA_SAIDA_ANTECIPADA * 100).toFixed(0)}%) — CONTA_OPERACIONAL`,
    reference_id: bet.topic_id,
  });

  return NextResponse.json({ success: true, devolvido: devolucao, comissao });
}
