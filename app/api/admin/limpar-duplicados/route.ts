import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Remove topics duplicados (mesmo título, status active, is_private false).
 * Mantém o que tem mais volume de apostas; os outros são cancelados.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();

  // Busca todos os tópicos ativos públicos
  const { data: topics } = await admin
    .from("topics")
    .select("id, title, closes_at")
    .eq("status", "active")
    .eq("is_private", false)
    .order("closes_at");

  if (!topics) return NextResponse.json({ removed: 0 });

  // Agrupar por título
  const byTitle = new Map<string, typeof topics>();
  for (const t of topics) {
    if (!byTitle.has(t.title)) byTitle.set(t.title, []);
    byTitle.get(t.title)!.push(t);
  }

  const toDelete: string[] = [];
  for (const [, group] of byTitle) {
    if (group.length <= 1) continue;
    // Busca volume de cada um; mantém o com mais volume (ou o primeiro se sem apostas)
    const volumes = await Promise.all(
      group.map(async (t) => {
        const { data } = await admin.from("v_topic_stats").select("total_volume").eq("topic_id", t.id).single();
        return { id: t.id, volume: (data as any)?.total_volume ?? 0 };
      })
    );
    volumes.sort((a, b) => b.volume - a.volume);
    // Primeiro é o que fica, o resto vai para cancelled
    for (let i = 1; i < volumes.length; i++) {
      toDelete.push(volumes[i].id);
    }
  }

  if (toDelete.length === 0) return NextResponse.json({ removed: 0 });

  // Cancela os duplicados sem apostas ativas (seguro) ou se volume 0
  await admin.from("topics").update({ status: "cancelled" }).in("id", toDelete);

  return NextResponse.json({ removed: toDelete.length, ids: toDelete });
}
