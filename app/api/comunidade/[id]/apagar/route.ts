/**
 * Criador apaga (cancela) um evento da Comunidade enquanto ele ainda NÃO foi
 * confirmado — ou seja, enquanto não houver palpites nos dois lados. Sem palpites
 * dos dois lados não há disputa real travando Z$ de terceiros, então cancelar +
 * reembolsar é seguro e conserva Z$ (regra 4). Assim que os dois lados têm volume
 * o evento está confirmado e a opção some.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reembolsarComunidade } from "@/lib/comunidade";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("community_events")
    .select("creator_id, status")
    .eq("id", params.id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  }
  if (event.creator_id !== user.id) {
    return NextResponse.json({ error: "Apenas o criador pode apagar este evento" }, { status: 403 });
  }
  if (event.status !== "active") {
    return NextResponse.json({ error: "Este evento não pode mais ser apagado" }, { status: 400 });
  }

  const { data: stats } = await admin
    .from("v_community_event_stats")
    .select("volume_sim, volume_nao")
    .eq("event_id", params.id)
    .single();

  const volumeSim = (stats as any)?.volume_sim ?? 0;
  const volumeNao = (stats as any)?.volume_nao ?? 0;

  // Confirmado = palpites nos dois lados. A partir daí há dinheiro de terceiro em
  // disputa e o evento precisa ser resolvido, não apagado.
  if (volumeSim > 0 && volumeNao > 0) {
    return NextResponse.json(
      { error: "Evento já confirmado: há palpites nos dois lados. Use a resolução." },
      { status: 400 },
    );
  }

  // Reembolsa eventuais palpites de um lado só (no-op se não houver nenhum).
  await reembolsarComunidade(admin, params.id, "Evento apagado pelo criador");

  await admin
    .from("community_events")
    .update({ status: "creator_cancelled", resolved_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({ success: true });
}
