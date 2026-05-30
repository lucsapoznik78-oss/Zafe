import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getOrCreateReputation } from "@/lib/comunidade";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { title, description, category, closes_at } = await request.json();

  if (!title || !description || !closes_at) {
    return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: "Título muito longo (máx 120 chars)" }, { status: 400 });
  }
  if (description.length > 500) {
    return NextResponse.json({ error: "Descrição muito longa (máx 500 chars)" }, { status: 400 });
  }

  const closesDate = new Date(closes_at);
  const now = new Date();
  if (closesDate.getTime() - now.getTime() < 3600000) {
    return NextResponse.json({ error: "Prazo mínimo: 1 hora" }, { status: 400 });
  }
  const maxDate = new Date(now.getTime() + 90 * 24 * 3600000);
  if (closesDate > maxDate) {
    return NextResponse.json({ error: "Prazo máximo: 90 dias" }, { status: 400 });
  }

  // Check reputation
  const admin = createAdminClient();
  const rep = await getOrCreateReputation(admin, user.id);
  if (!rep || rep.score < 30) {
    return NextResponse.json({ error: "Sua nota de criador está abaixo de 30. Não é possível criar eventos." }, { status: 403 });
  }
  if (rep.blocked_until && new Date(rep.blocked_until) > now) {
    return NextResponse.json({ error: "Você está temporariamente bloqueado de criar eventos." }, { status: 403 });
  }

  // Rate limit: max active events based on score
  const maxActive = rep.score >= 90 ? 10 : 5;
  const { count } = await admin
    .from("community_events")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .in("status", ["active", "awaiting_resolution"]);

  if ((count ?? 0) >= maxActive) {
    return NextResponse.json({ error: `Limite de ${maxActive} eventos ativos. Resolva os pendentes primeiro.` }, { status: 400 });
  }

  const resolutionDeadline = new Date(closesDate.getTime() + 72 * 3600000).toISOString();

  const { data: event, error } = await admin
    .from("community_events")
    .insert({
      creator_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category: category || "outros",
      closes_at: closesDate.toISOString(),
      resolution_deadline: resolutionDeadline,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Erro ao criar evento" }, { status: 500 });
  }

  // Increment events_created
  await admin
    .from("creator_reputation")
    .update({
      events_created: (rep.events_created ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json({ success: true, event_id: event.id });
}
