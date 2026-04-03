import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { friendship_id } = await request.json();

  // Só o remetente pode cancelar solicitação pendente
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendship_id)
    .eq("requester_id", user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: "Erro ao cancelar solicitação" }, { status: 500 });
  return NextResponse.json({ success: true });
}
