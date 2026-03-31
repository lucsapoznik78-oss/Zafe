import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { friendship_id } = await req.json();

  // Verificar que o usuário faz parte desta amizade
  const { data: friendship } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id")
    .eq("id", friendship_id)
    .eq("status", "accepted")
    .single();

  if (!friendship) return NextResponse.json({ error: "Amizade não encontrada" }, { status: 404 });

  const isMember = friendship.requester_id === user.id || friendship.addressee_id === user.id;
  if (!isMember) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  await supabase.from("friendships").delete().eq("id", friendship_id);

  return NextResponse.json({ success: true });
}
