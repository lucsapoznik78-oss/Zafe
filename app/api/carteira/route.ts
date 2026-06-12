import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/carteira — perfil + saldo do usuário logado.
// Lê com admin client após validar a sessão: a leitura direta de `wallets`
// pelo browser client falha para algumas sessões (saldo aparecia "Z$ 0,00"
// no Navbar mesmo com saldo no banco), enquanto a auth server-side funciona.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const [{ data: profile }, { data: wallet }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).single(),
    admin.from("wallets").select("*").eq("user_id", user.id).single(),
  ]);

  return NextResponse.json({ profile, wallet });
}
