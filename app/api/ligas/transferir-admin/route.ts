import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { liga_id, new_creator_id } = await req.json();
  if (!liga_id || !new_creator_id) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });

  // Verificar que o usuário atual é o criador
  const { data: liga } = await supabase
    .from("ligas")
    .select("creator_id")
    .eq("id", liga_id)
    .single();

  if (!liga || liga.creator_id !== user.id) {
    return NextResponse.json({ error: "Apenas o criador pode transferir a liderança" }, { status: 403 });
  }

  if (new_creator_id === user.id) {
    return NextResponse.json({ error: "Você já é o criador" }, { status: 400 });
  }

  // Verificar que o novo criador é membro ativo
  const { data: membership } = await supabase
    .from("liga_members")
    .select("id")
    .eq("liga_id", liga_id)
    .eq("user_id", new_creator_id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Usuário não é membro ativo desta liga" }, { status: 404 });
  }

  await supabase.from("ligas").update({ creator_id: new_creator_id }).eq("id", liga_id);

  return NextResponse.json({ success: true });
}
