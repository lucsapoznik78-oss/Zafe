import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  const { topic_id } = await request.json();
  await supabase.from("topics").update({ status: "active" }).eq("id", topic_id);
  return NextResponse.json({ success: true });
}
