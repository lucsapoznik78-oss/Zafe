import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { name, description, color, is_public, parent_liga_id } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  // If creating a sub-league, user must be active member of parent
  if (parent_liga_id) {
    const { data: membership } = await supabase
      .from("liga_members")
      .select("id")
      .eq("liga_id", parent_liga_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    if (!membership) return NextResponse.json({ error: "Você não é membro da liga pai" }, { status: 403 });
  }

  // ligas/liga_members são service-role-only (audit F-09): a policy antiga
  // (`auth.uid() IS NOT NULL`) deixava qualquer logado inserir linha com
  // creator_id/user_id alheio. creator_id vem daqui, nunca do request, e a
  // checagem de membro da liga pai acima é a autorização para sub-liga.
  const admin = createAdminClient();

  const { data: liga, error } = await admin.from("ligas").insert({
    name: name.trim(),
    description: description?.trim() ?? null,
    creator_id: user.id,
    // Padrão do grupo novo. Era o roxo da marca antiga; segue o primeiro slot
    // do seletor em components/ligas/CreateLigaModal.tsx.
    color: color ?? "#FFC53D",
    is_public: is_public === true,
    parent_liga_id: parent_liga_id ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: "Erro ao criar liga" }, { status: 500 });

  // Criador entra automaticamente como membro ativo
  await admin.from("liga_members").insert({
    liga_id: liga.id,
    user_id: user.id,
    invited_by: user.id,
    status: "active",
    joined_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, liga });
}
