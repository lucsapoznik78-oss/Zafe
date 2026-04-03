/**
 * Participante recusa convite para aposta privada — rejeita o invite, sem debitar nada
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: participant } = await supabase
    .from("topic_participants")
    .select("id, status")
    .eq("topic_id", topicId)
    .eq("user_id", user.id)
    .single();

  if (!participant) return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  if (participant.status !== "invited") return NextResponse.json({ error: "Convite já processado" }, { status: 400 });

  const admin = createAdminClient();
  await admin.from("topic_participants").delete().eq("id", participant.id);

  return NextResponse.json({ success: true });
}
