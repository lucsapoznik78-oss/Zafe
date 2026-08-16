/**
 * POST /api/perfil/figura/comprar — { itemId } → um acessório.
 *
 * O corpo NÃO tem campo de preço. O preço sai de `precoPorId` aqui no servidor,
 * e a RPC `figura_comprar` só tem EXECUTE para o service_role — então o único
 * caminho até um débito é este arquivo, com o número que este arquivo escolheu.
 *
 * Idempotência é do banco: a RPC insere no inventário ANTES de debitar, e o
 * índice único (user_id, item_id) decide a corrida entre dois cliques. Aqui não
 * há `select` para "ver se já tem" — seria exatamente a janela que queremos
 * fechar.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { POR_ID, precoDe } from "@/lib/figura/catalogo";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({ itemId: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const item = POR_ID.get(parsed.data.itemId);
  if (!item) return NextResponse.json({ error: "Item não existe" }, { status: 404 });

  const admin = createAdminClient();

  // Comprar acessório sem ter o editor não faz sentido e abriria um caminho de
  // gasto que a UI não mostra. A leitura é do próprio usuário, não do body.
  const { data: perfil } = await admin
    .from("profiles")
    .select("figura_desbloqueada")
    .eq("id", user.id)
    .single();
  if (!perfil?.figura_desbloqueada) {
    return NextResponse.json({ error: "Desbloqueie o personagem primeiro" }, { status: 403 });
  }

  const preco = precoDe(item);
  const { data, error } = await admin.rpc("figura_comprar", {
    p_user: user.id,
    p_item: item.id,
    p_preco: preco,
  });

  if (error) {
    if (error.message.includes("saldo insuficiente")) {
      return NextResponse.json(
        { error: `Saldo insuficiente — ${item.nome} custa Z$ ${preco}` },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "Não foi possível comprar" }, { status: 500 });
  }

  const r = data as { ok: boolean; ja_possui: boolean; cobrado: number };
  return NextResponse.json({
    success: true,
    itemId: item.id,
    ja_possui: r.ja_possui,
    cobrado: r.cobrado,
  });
}
