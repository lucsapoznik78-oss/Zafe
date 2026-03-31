import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { liga_id } = await req.json();
  if (!liga_id) return NextResponse.json({ error: "liga_id obrigatório" }, { status: 400 });

  // Verificar se o usuário é membro ativo
  const { data: membership } = await supabase
    .from("liga_members")
    .select("id")
    .eq("liga_id", liga_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return NextResponse.json({ error: "Você não é membro desta liga" }, { status: 404 });

  // Verificar se é o criador
  const { data: liga } = await supabase
    .from("ligas")
    .select("creator_id")
    .eq("id", liga_id)
    .single();

  if (liga?.creator_id === user.id) {
    return NextResponse.json(
      { error: "O criador não pode sair da liga. Exclua a liga ou transfira a liderança." },
      { status: 403 }
    );
  }

  await supabase.from("liga_members").delete().eq("id", membership.id);

  return NextResponse.json({ success: true });
}
