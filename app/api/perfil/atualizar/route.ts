import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { full_name, username } = await request.json();

  if (!full_name?.trim() || !username?.trim()) {
    return NextResponse.json({ error: "Nome e username são obrigatórios" }, { status: 400 });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (cleanUsername.length < 3) {
    return NextResponse.json({ error: "Username deve ter pelo menos 3 caracteres" }, { status: 400 });
  }

  // Verificar unicidade do username
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", cleanUsername)
    .neq("id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Username já está em uso" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: full_name.trim(), username: cleanUsername })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });

  return NextResponse.json({ success: true });
}
