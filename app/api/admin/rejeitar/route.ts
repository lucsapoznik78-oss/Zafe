import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const { topic_id } = await request.json();
  await admin.from("topics").update({ status: "cancelled" }).eq("id", topic_id);
  return NextResponse.json({ success: true });
}
