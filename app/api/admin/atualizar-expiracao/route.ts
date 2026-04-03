import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { topic_id, closes_at } = await request.json();
  if (!topic_id || !closes_at) return NextResponse.json({ error: "topic_id e closes_at obrigatórios" }, { status: 400 });

  const date = new Date(closes_at);
  if (isNaN(date.getTime())) return NextResponse.json({ error: "Data inválida" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("topics").update({ closes_at: date.toISOString() }).eq("id", topic_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, closes_at: date.toISOString() });
}
