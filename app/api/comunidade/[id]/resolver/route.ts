import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { pagarComunidade, adjustReputation } from "@/lib/comunidade";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { resolution } = await request.json();
  if (!["sim", "nao"].includes(resolution)) {
    return NextResponse.json({ error: "Resultado inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("community_events")
    .select("creator_id, status, closes_at")
    .eq("id", params.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }
  if (event.creator_id !== user.id) {
    return NextResponse.json({ error: "Apenas o criador pode resolver este evento" }, { status: 403 });
  }
  // Permite resolver eventos "active" cujo prazo já passou (cron pode não ter rodado ainda)
  const isExpiredActive = event.status === "active" && new Date(event.closes_at) < new Date();
  if (event.status !== "awaiting_resolution" && !isExpiredActive) {
    return NextResponse.json({ error: "Este evento não está aguardando resolução" }, { status: 400 });
  }

  const result = await pagarComunidade(admin, params.id, resolution);

  revalidatePath("/comunidade");
  revalidatePath(`/comunidade/${params.id}`);
  revalidatePath("/perfil");
  revalidatePath("/ranking");

  // Update reputation: +2 for resolved
  await adjustReputation(admin, user.id, 2, {
    events_resolved: (await admin.from("creator_reputation").select("events_resolved").eq("user_id", user.id).single()).data?.events_resolved + 1 || 1,
    streak: (await admin.from("creator_reputation").select("streak").eq("user_id", user.id).single()).data?.streak + 1 || 1,
  });

  return NextResponse.json({ success: true, ...result });
}
