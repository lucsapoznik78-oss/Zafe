import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { member_id } = await request.json();

  const { error } = await supabase
    .from("liga_members")
    .delete()
    .eq("id", member_id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: "Erro ao recusar convite" }, { status: 500 });
  return NextResponse.json({ success: true });
}
