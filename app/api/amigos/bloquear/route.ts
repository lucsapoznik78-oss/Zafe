import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { blocked_id } = await req.json();
  if (!blocked_id) return NextResponse.json({ error: "blocked_id obrigatório" }, { status: 400 });
  if (blocked_id === user.id) return NextResponse.json({ error: "Não pode bloquear a si mesmo" }, { status: 400 });

  // Verificar se já existe uma relação
  const { data: existing } = await supabase
    .from("friendships")
    .select("id, requester_id")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${blocked_id}),and(requester_id.eq.${blocked_id},addressee_id.eq.${user.id})`
    )
    .single();

  if (existing) {
    // Atualizar status para blocked (o bloqueador é sempre o requester)
    if (existing.requester_id === user.id) {
      await supabase.from("friendships").update({ status: "blocked" }).eq("id", existing.id);
    } else {
      // Trocar os lados e marcar como bloqueado
      await supabase.from("friendships").delete().eq("id", existing.id);
      await supabase.from("friendships").insert({
        requester_id: user.id,
        addressee_id: blocked_id,
        status: "blocked",
      });
    }
  } else {
    await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: blocked_id,
      status: "blocked",
    });
  }

  return NextResponse.json({ success: true });
}
