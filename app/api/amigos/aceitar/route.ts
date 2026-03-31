import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { friendship_id } = await request.json();

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendship_id)
    .eq("addressee_id", user.id);

  if (error) return NextResponse.json({ error: "Erro ao aceitar amizade" }, { status: 500 });
  return NextResponse.json({ success: true });
}
