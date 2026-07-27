import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Devolve o contexto de 2FA do PRÓPRIO usuário logado.
//
// Existe porque o LoginForm lia `two_fa_enabled, two_fa_method, phone` direto de
// `profiles` com o client do browser. Como a policy de leitura de profiles é
// `USING (true)`, manter o SELECT de `phone` para `authenticated` deixava
// qualquer logado ler o telefone de todos os usuários (audit F-06). Aqui o
// telefone sai do banco com service role e só é devolvido para o dono da sessão.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("two_fa_enabled, two_fa_method, phone")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    two_fa_enabled: profile?.two_fa_enabled ?? false,
    two_fa_method: profile?.two_fa_method ?? "email",
    phone: profile?.phone ?? "",
  });
}
