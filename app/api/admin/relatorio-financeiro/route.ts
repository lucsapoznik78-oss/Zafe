import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Relatório financeiro para fins contábeis/fiscais.
 *
 * SEPARAÇÃO:
 *   - Receita própria (sua): comissões (4% do depósito)
 *   - Passivo de usuários: saldo em carteiras (dinheiro que pertence aos usuários)
 *   - Volume intermediado: depósitos brutos, apostas, saques — não é sua receita
 *
 * Isso garante que a Receita Federal veja apenas as comissões como receita,
 * e o restante como obrigações/passivo (dinheiro custodiado).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // ex: 2025-01-01
  const to = searchParams.get("to");     // ex: 2025-12-31

  let query = supabase.from("transactions").select("type, amount, net_amount, created_at");
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59Z");

  const { data: txs } = await query;

  const sum = (type: string) =>
    (txs ?? []).filter((t) => t.type === type).reduce((s, t) => s + (t.net_amount ?? t.amount), 0);

  const count = (type: string) =>
    (txs ?? []).filter((t) => t.type === type).length;

  // Passivo atual: soma de todos os saldos de carteira (o que você deve aos usuários)
  const { data: wallets } = await supabase.from("wallets").select("balance");
  const totalUserFunds = (wallets ?? []).reduce((s, w) => s + w.balance, 0);

  const grossDeposits = sum("deposit");       // volume intermediado — NÃO é sua receita
  const commissions   = sum("commission");    // SUA receita — 4% de cada depósito
  const withdrawals   = sum("withdraw");      // saídas — reduz passivo
  const betsPlaced    = sum("bet_placed");    // movimentação interna
  const betsWon       = sum("bet_won");       // movimentação interna
  const refunds       = sum("bet_refund");    // devoluções

  return NextResponse.json({
    periodo: { from: from ?? "início", to: to ?? "hoje" },

    // ── SUA RECEITA (o que você declara pra Receita Federal) ──
    receita_propria: {
      comissoes: commissions,
      contagem_depositos: count("deposit"),
      nota: "Apenas este valor é receita da Zafe. Base para ISS, PIS, COFINS.",
    },

    // ── PASSIVO (dinheiro dos usuários que você custódia) ──
    passivo_usuarios: {
      saldo_atual_carteiras: totalUserFunds,
      nota: "Este valor pertence aos usuários. Não é receita. Aparece como passivo no balanço.",
    },

    // ── VOLUME INTERMEDIADO (aparece no extrato bancário mas NÃO é receita) ──
    volume_intermediado: {
      depositos_brutos: grossDeposits,
      saques: withdrawals,
      apostas_realizadas: betsPlaced,
      premios_pagos: betsWon,
      reembolsos: refunds,
      nota: "Este volume passa pela plataforma mas pertence aos usuários. Documente como custódia.",
    },

    // ── RESUMO CONTÁBIL ──
    resumo: {
      receita_declaravel: commissions,
      passivo_total: totalUserFunds,
      ratio_comissao_pct: grossDeposits > 0
        ? parseFloat(((commissions / grossDeposits) * 100).toFixed(2))
        : 0,
    },
  });
}
