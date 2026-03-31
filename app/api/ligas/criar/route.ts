import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { name, description, color } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const { data: liga, error } = await supabase.from("ligas").insert({
    name: name.trim(),
    description: description?.trim() ?? null,
    creator_id: user.id,
    color: color ?? "#86efac",
  }).select().single();

  if (error) return NextResponse.json({ error: "Erro ao criar liga" }, { status: 500 });

  // Criador entra automaticamente como membro ativo
  await supabase.from("liga_members").insert({
    liga_id: liga.id,
    user_id: user.id,
    invited_by: user.id,
    status: "active",
    joined_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, liga });
}
