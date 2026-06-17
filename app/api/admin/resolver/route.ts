import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { pagarVencedores, pagarVencedoresMulti, reembolsarTodos } from "@/lib/payout";

export async function POST(request: Request) {
  // Auth check com client de usuário
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Todas as escritas com admin client — RLS bloquearia updates em wallets/transactions de outros usuários
  const admin = createAdminClient();

  const { topic_id, resolution, winning_outcome_id } = await request.json();

  const { data: topic } = await admin.from("topics").select("status, market_type").eq("id", topic_id).single();
  if (!topic) return NextResponse.json({ error: "Mercado não encontrado" }, { status: 404 });
  if (topic.status === "resolved" || topic.status === "cancelled") {
    return NextResponse.json({ error: "Mercado já foi resolvido" }, { status: 400 });
  }

  if (resolution === "cancelled") {
    await reembolsarTodos(admin, topic_id, "Mercado cancelado pelo admin", user.id);
    revalidatePath("/liga");
    revalidatePath("/economico");
    revalidatePath("/ranking");
    revalidatePath("/perfil");
    return NextResponse.json({ success: true });
  }

  revalidatePath("/liga");
  revalidatePath("/economico");
  revalidatePath(`/liga/${topic_id}`);
  revalidatePath(`/economico/${topic_id}`);
  revalidatePath("/ranking");
  revalidatePath("/perfil");

  if (topic.market_type === "multi") {
    if (!winning_outcome_id) {
      return NextResponse.json({ error: "Selecione o resultado vencedor" }, { status: 400 });
    }
    const result = await pagarVencedoresMulti(admin, topic_id, winning_outcome_id, user.id);
    return NextResponse.json({ success: true, ...result });
  }

  const result = await pagarVencedores(admin, topic_id, resolution, user.id);
  return NextResponse.json({ success: true, ...result });
}
