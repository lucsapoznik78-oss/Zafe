import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { addressee_id } = await request.json();
  if (!addressee_id || addressee_id === user.id) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { error } = await supabase.from("friendships").insert({
    requester_id: user.id,
    addressee_id,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: "Já existe uma solicitação" }, { status: 400 });

  const { data: requesterProfile } = await supabase
    .from("profiles").select("full_name, username").eq("id", user.id).single();

  await supabase.from("notifications").insert({
    user_id: addressee_id,
    type: "friend_request",
    title: "Nova solicitação de amizade",
    body: `${requesterProfile?.full_name ?? requesterProfile?.username ?? "Alguém"} quer ser seu amigo.`,
    data: { requester_id: user.id },
  });

  return NextResponse.json({ success: true });
}
