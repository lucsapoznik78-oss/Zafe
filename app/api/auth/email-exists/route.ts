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
  const { data, error } = await admin
    .schema("auth")
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Erro ao verificar" }, { status: 500 });
  }

  return NextResponse.json({ exists: !!data && data.length > 0 });
}
