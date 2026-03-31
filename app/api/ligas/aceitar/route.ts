import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { liga_member_id, accept } = await request.json();

  if (accept) {
    await supabase.from("liga_members").update({
      status: "active",
      joined_at: new Date().toISOString(),
    }).eq("id", liga_member_id).eq("user_id", user.id);
  } else {
    await supabase.from("liga_members").update({ status: "declined" })
      .eq("id", liga_member_id).eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}
