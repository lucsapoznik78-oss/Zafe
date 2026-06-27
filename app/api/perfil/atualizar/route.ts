import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const { full_name, username } = body;

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

  // Endereço (auto-declarado, opcional na edição). Só inclui campos enviados.
  const update: Record<string, string | null> = {
    full_name: full_name.trim(),
    username: cleanUsername,
  };
  if ("cep" in body) {
    const cepClean = String(body.cep ?? "").replace(/\D/g, "");
    if (cepClean && cepClean.length !== 8) {
      return NextResponse.json({ error: "CEP inválido — use 8 dígitos." }, { status: 400 });
    }
    update.cep = cepClean || null;
  }
  if ("uf" in body) {
    const ufClean = String(body.uf ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (ufClean && ufClean.length !== 2) {
      return NextResponse.json({ error: "UF inválida — use a sigla de 2 letras." }, { status: 400 });
    }
    update.uf = ufClean || null;
  }
  for (const field of ["logradouro", "numero", "complemento", "bairro", "cidade"] as const) {
    if (field in body) update[field] = String(body[field] ?? "").trim() || null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Erro ao atualizar perfil" }, { status: 500 });

  return NextResponse.json({ success: true });
}
