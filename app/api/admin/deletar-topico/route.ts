import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { topic_id } = await request.json();
  if (!topic_id) return NextResponse.json({ error: "topic_id obrigatório" }, { status: 400 });

  const admin = createAdminClient();

  // Só permite deletar topics sem apostas (status active ou pending)
  const { data: topic } = await admin.from("topics").select("status").eq("id", topic_id).single();
  if (!topic) return NextResponse.json({ error: "Tópico não encontrado" }, { status: 404 });
  if (!["active", "pending"].includes(topic.status)) {
    return NextResponse.json({ error: "Só é possível deletar mercados ativos ou pendentes sem apostas" }, { status: 400 });
  }

  const { count: betCount } = await admin.from("bets").select("id", { count: "exact", head: true }).eq("topic_id", topic_id);
  if ((betCount ?? 0) > 0) {
    return NextResponse.json({ error: "Não é possível deletar mercados com apostas" }, { status: 400 });
  }

  await admin.from("topic_snapshots").delete().eq("topic_id", topic_id);
  await admin.from("topics").delete().eq("id", topic_id);

  return NextResponse.json({ success: true });
}
