import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { invite_id } = await request.json();

  await supabase
    .from("private_bet_invites")
    .update({ status: "declined" })
    .eq("id", invite_id)
    .eq("invitee_id", user.id);

  return NextResponse.json({ success: true });
}
