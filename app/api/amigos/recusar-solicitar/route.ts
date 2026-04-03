import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { friendship_id } = await request.json();

  // Só o destinatário pode recusar
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendship_id)
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: "Erro ao recusar solicitação" }, { status: 500 });
  return NextResponse.json({ success: true });
}
