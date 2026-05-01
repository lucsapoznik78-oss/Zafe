import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { liga_id } = await request.json();
  if (!liga_id) return NextResponse.json({ error: "liga_id obrigatório" }, { status: 400 });

  // Verify the league is public
  const { data: liga } = await supabase
    .from("ligas")
    .select("id, is_public")
    .eq("id", liga_id)
    .eq("is_public", true)
    .single();

  if (!liga) return NextResponse.json({ error: "Liga não encontrada ou privada" }, { status: 404 });

  // Check not already a member
  const { data: existing } = await supabase
    .from("liga_members")
    .select("id, status")
    .eq("liga_id", liga_id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    if (existing.status === "active") return NextResponse.json({ error: "Você já é membro desta liga" }, { status: 409 });
    // Reactivate if declined
    await supabase.from("liga_members").update({ status: "active", joined_at: new Date().toISOString() }).eq("id", existing.id);
    return NextResponse.json({ success: true });
  }

  await supabase.from("liga_members").insert({
    liga_id,
    user_id: user.id,
    invited_by: user.id,
    status: "active",
    joined_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
