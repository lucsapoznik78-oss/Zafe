/**
 * Qualquer participante pode convidar alguém para o seu próprio lado
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/webpush";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const admin = createAdminClient();

  const { user_id: inviteeId } = await req.json();

  // Verificar que o convidador é participante aceito
  const { data: me } = await supabase
    .from("topic_participants")
    .select("side")
    .eq("topic_id", topicId)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .single();

  if (!me) return NextResponse.json({ error: "Você não é participante desta aposta" }, { status: 403 });

  // Verificar fase
  const { data: topic } = await supabase
    .from("topics")
    .select("private_phase, title")
    .eq("id", topicId).single();

  if (topic?.private_phase !== "recruiting") {
    return NextResponse.json({ error: "Recrutamento encerrado" }, { status: 400 });
  }

  // Verificar se já está convidado/participando
  const { data: existing } = await supabase
    .from("topic_participants")
    .select("id")
    .eq("topic_id", topicId)
    .eq("user_id", inviteeId)
    .single();

  if (existing) return NextResponse.json({ error: "Usuário já convidado ou participando" }, { status: 400 });

  // Criar convite para o mesmo lado do convidador
  await admin.from("topic_participants").insert({
    topic_id: topicId, user_id: inviteeId,
    side: me.side, status: "invited",
    invited_by: user.id,
  });

  const { data: profile } = await supabase
    .from("profiles").select("username").eq("id", user.id).single();

  const inviteBody = `${profile?.username ?? "Alguém"} te convidou para a aposta: "${topic?.title?.slice(0, 50)}"`;
  await admin.from("notifications").insert({
    user_id: inviteeId,
    type: "bet_invite",
    title: "Convite para aposta privada",
    body: inviteBody,
    data: { topic_id: topicId, side: me.side },
  });
  sendPushToUser(supabase, inviteeId, {
    title: "Convite para aposta privada 🤝",
    body: inviteBody,
    url: `/apostas-privadas/${topicId}`,
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
