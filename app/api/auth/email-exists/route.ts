import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/auth/email-exists?e=foo@bar.com — usado APENAS pela tela de
// "Esqueci minha senha" para dar mensagem clara quando o email não tem
// cadastro (a UX genérica confundia usuários que erravam o email).
//
// ⚠️ Trade-off de segurança: este endpoint permite enumeração de contas
// (atacante descobre quais emails têm cadastro). Foi uma decisão explícita
// de produto — priorizar UX sobre a mitigação de enumeração. Se isso virar
// problema, considerar: rate-limit por IP + captcha.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get("e") ?? "").toLowerCase().trim();

  // Validação básica de formato — não vaza informação
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ exists: false, invalid: true });
  }

  const admin = createAdminClient();
  // Vai via RPC (migration 058) — service_role -> auth.users. Antes usava
  // .schema("auth").from("users"), mas PostgREST não expõe o schema auth.
  const { data, error } = await admin.rpc("email_exists", { p_email: email });

  if (error) {
    return NextResponse.json({ error: "Erro ao verificar" }, { status: 500 });
  }

  return NextResponse.json({ exists: !!data });
}
