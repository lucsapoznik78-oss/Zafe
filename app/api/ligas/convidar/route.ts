import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { liga_id, friend_id } = await request.json();
  if (!liga_id || !friend_id) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  // Verificar se quem convida é membro ativo
  const { data: membership } = await supabase
    .from("liga_members")
    .select("id")
    .eq("liga_id", liga_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return NextResponse.json({ error: "Você não faz parte desta liga" }, { status: 403 });

  const { error } = await supabase.from("liga_members").insert({
    liga_id,
    user_id: friend_id,
    invited_by: user.id,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: "Amigo já foi convidado" }, { status: 400 });

  await supabase.from("notifications").insert({
    user_id: friend_id,
    type: "bet_invite",
    payload: { liga_id, inviter_id: user.id, type: "liga_invite" },
    read: false,
  });

  return NextResponse.json({ success: true });
}
