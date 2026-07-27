import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { member_id } = await request.json();

  // liga_members é service-role-only (audit F-09), e como em /sair isto corrige
  // um bug: sem policy de DELETE, a RLS negava o delete do client do usuário e
  // o convite continuava lá. Os três .eq() são a autorização e não podem sair.
  const { error } = await createAdminClient()
    .from("liga_members")
    .delete()
    .eq("id", member_id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: "Erro ao recusar convite" }, { status: 500 });
  return NextResponse.json({ success: true });
}
