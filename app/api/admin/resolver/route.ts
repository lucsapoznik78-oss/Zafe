import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { pagarVencedores, reembolsarTodos } from "@/lib/payout";

export async function POST(request: Request) {
  // Auth check com client de usuário
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Todas as escritas com admin client — RLS bloquearia updates em wallets/transactions de outros usuários
  const admin = createAdminClient();

  const { topic_id, resolution } = await request.json();

  const { data: topic } = await admin.from("topics").select("status").eq("id", topic_id).single();
  if (!topic) return NextResponse.json({ error: "Mercado não encontrado" }, { status: 404 });
  if (topic.status === "resolved" || topic.status === "cancelled") {
    return NextResponse.json({ error: "Mercado já foi resolvido" }, { status: 400 });
  }

  if (resolution === "cancelled") {
    await reembolsarTodos(admin, topic_id, "Mercado cancelado pelo admin", user.id);
    return NextResponse.json({ success: true });
  }

  const result = await pagarVencedores(admin, topic_id, resolution, user.id);
  return NextResponse.json({ success: true, ...result });
}
