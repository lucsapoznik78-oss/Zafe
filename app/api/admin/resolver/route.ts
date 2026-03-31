import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { pagarVencedores, reembolsarTodos } from "@/lib/payout";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
  return data?.is_admin === true;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { topic_id, resolution } = await request.json();

  if (resolution === "cancelled") {
    await reembolsarTodos(supabase, topic_id, "Mercado cancelado", user.id);
    await supabase.from("topics").update({ status: "cancelled", resolved_by: user.id }).eq("id", topic_id);
    return NextResponse.json({ success: true });
  }

  const result = await pagarVencedores(supabase, topic_id, resolution, user.id);
  return NextResponse.json({ success: true, ...result });
}
