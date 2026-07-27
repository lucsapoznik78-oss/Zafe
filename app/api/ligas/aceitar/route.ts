import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { liga_member_id, accept } = await request.json();

  // liga_members é service-role-only (audit F-09). O `.eq("user_id", user.id)`
  // é a autorização e NÃO pode sair: é o que impede aceitar convite alheio,
  // já que o service role ignora a RLS.
  const admin = createAdminClient();

  if (accept) {
    await admin.from("liga_members").update({
      status: "active",
      joined_at: new Date().toISOString(),
    }).eq("id", liga_member_id).eq("user_id", user.id);
  } else {
    await admin.from("liga_members").update({ status: "declined" })
      .eq("id", liga_member_id).eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}
