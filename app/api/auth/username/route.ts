import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/auth/username?u=joaosilva — checa disponibilidade do nome de
// usuário no cadastro (rota pública; o form checa antes do signUp). A
// unicidade REAL é garantida pelo UNIQUE de profiles.username + o sufixo
// automático do trigger handle_new_user — isto aqui é só UX.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const u = String(searchParams.get("u") ?? "").toLowerCase().trim();

  if (!/^[a-z0-9_]{3,20}$/.test(u)) {
    return NextResponse.json({
      available: false,
      error: "Use de 3 a 20 caracteres: letras minúsculas, números ou _",
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("username", u)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Erro ao verificar" }, { status: 500 });
  }

  return NextResponse.json({ available: !data || data.length === 0 });
}
