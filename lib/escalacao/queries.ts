// Leituras e guarda de acesso do painel de Escalação.
//
// Fase 2 é SÓ admin: não há uma rota pública sequer. Enquanto
// ESCALACAO_ENABLED for false, nada disto aparece para o usuário.

import { NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Padrão de toda rota de admin do repo: sessão → is_admin → service role.
 * Devolve `{ erro }` pronto para retornar, ou `{ admin, userId }`.
 */
export async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) } as const;
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) {
    return { erro: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) } as const;
  }

  return { admin: createAdminClient(), userId: user.id } as const;
}
