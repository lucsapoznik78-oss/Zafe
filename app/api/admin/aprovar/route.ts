import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { debitBalance } from "@/lib/wallet";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
  return data?.is_admin === true;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { topic_id } = await request.json();
  const admin = createAdminClient();

  // Activate the topic
  await admin.from("topics").update({ status: "active" }).eq("id", topic_id);

  // 1. Remove any bets with no money (amount <= 0)
  await admin.from("bets").delete().eq("topic_id", topic_id).lte("amount", 0);

  // 2. Check if any real bets exist
  const { count } = await admin
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", topic_id);

  // 3. If no bets at all, seed both sides with Z$1 (liquidez inicial)
  if ((count ?? 0) === 0) {
    // Debita o saldo de quem semeia (Z$2 = 1 sim + 1 nao) ANTES de inserir os
    // bets. Semear sem débito cunhava Z$ direto no pool, quebrando a conservação
    // (regra 4). Se faltar saldo, ativa o mercado sem semear — melhor um pool
    // vazio do que Z$ criado do nada.
    const debit = await debitBalance(admin, user.id, 2);
    if (!debit.ok) {
      return NextResponse.json({
        success: true,
        seeded: false,
        warning: "Tópico ativado sem liquidez inicial (saldo insuficiente para semear).",
      });
    }

    await admin.from("bets").insert([
      {
        topic_id,
        user_id: user.id,
        side: "sim",
        amount: 1,
        status: "matched",
        matched_amount: 1,
        unmatched_amount: 0,
        is_private: false,
      },
      {
        topic_id,
        user_id: user.id,
        side: "nao",
        amount: 1,
        status: "matched",
        matched_amount: 1,
        unmatched_amount: 0,
        is_private: false,
      },
    ]);

    await admin.from("transactions").insert({
      user_id: user.id,
      type: "bet_placed",
      amount: 2,
      net_amount: 2,
      description: "Liquidez inicial (seed) do mercado",
      reference_id: topic_id,
    });
  }

  return NextResponse.json({ success: true });
}
