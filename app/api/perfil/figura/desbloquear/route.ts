/**
 * POST /api/perfil/figura/desbloquear — Z$ 100, uma vez na vida.
 *
 * Toda a parte de dinheiro está na RPC `figura_desbloquear`: marcar a flag e
 * debitar acontecem na mesma transação, e a marcação vem PRIMEIRO com o estado
 * anterior no WHERE, então dois cliques simultâneos cobram uma vez só. Aqui só
 * entra sessão, preço (do servidor) e tradução do erro.
 */
import { NextResponse } from "next/server";

import { ITENS_INICIAIS, precoPorId } from "@/lib/figura/catalogo";
import { PRECO_DESBLOQUEIO } from "@/lib/figura/tipos";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("figura_desbloquear", {
    p_user: user.id,
    p_preco: PRECO_DESBLOQUEIO,
  });

  if (error) {
    // A RPC levanta exceção em vez de retornar — é o que desfaz a marcação da
    // flag quando o saldo não cobre. Sem isso o editor sairia de graça.
    if (error.message.includes("saldo insuficiente")) {
      return NextResponse.json(
        { error: `Você precisa de Z$ ${PRECO_DESBLOQUEIO} para criar seu personagem` },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "Não foi possível desbloquear" }, { status: 500 });
  }

  const r = data as { ok: boolean; ja_tinha: boolean; cobrado: number };

  // Brinde de boas-vindas: ninguém fica pelado. Preço 0, `origem: 'inicial'`.
  // Fora da transação de propósito — se um destes falhar, o usuário já pagou e
  // já tem o editor; o pior caso é abrir sem camiseta, não perder Z$ 100. E a
  // RPC é idempotente, então o próximo POST completa o que faltou.
  await Promise.all(
    ITENS_INICIAIS.map((itemId) =>
      admin.rpc("figura_comprar", {
        p_user: user.id,
        p_item: itemId,
        p_preco: precoPorId(itemId) ?? 0,
      }),
    ),
  );

  return NextResponse.json({
    success: true,
    ja_tinha: r.ja_tinha,
    cobrado: r.cobrado,
    iniciais: ITENS_INICIAIS,
  });
}
