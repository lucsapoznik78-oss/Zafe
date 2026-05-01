/**
 * POST /api/topicos/[id]/watchlist — toggle follow/unfollow
 * GET  /api/topicos/[id]/watchlist — retorna status + threshold do usuário
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ watching: false });

  const { data } = await supabase
    .from("watchlist")
    .select("threshold_pct, notify_close")
    .eq("user_id", user.id)
    .eq("topic_id", id)
    .single();

  return NextResponse.json({ watching: !!data, threshold_pct: data?.threshold_pct ?? 10, notify_close: data?.notify_close ?? true });
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const threshold_pct: number = Math.min(50, Math.max(1, parseInt(body.threshold_pct ?? "10")));

  // Check if already watching
  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("topic_id", id)
    .single();

  if (existing) {
    // Toggle off — or update threshold if provided
    if (body.update_only) {
      await supabase.from("watchlist").update({ threshold_pct }).eq("id", existing.id);
      return NextResponse.json({ watching: true, threshold_pct });
    }
    await supabase.from("watchlist").delete().eq("id", existing.id);
    return NextResponse.json({ watching: false });
  }

  // Get current prob to use as baseline for movement alerts
  const admin = createAdminClient();
  const { data: stats } = await admin.from("v_topic_stats").select("prob_sim").eq("topic_id", id).single();

  await supabase.from("watchlist").insert({
    user_id: user.id,
    topic_id: id,
    threshold_pct,
    last_notified_prob: stats?.prob_sim ?? 0.5,
  });

  return NextResponse.json({ watching: true, threshold_pct });
}
