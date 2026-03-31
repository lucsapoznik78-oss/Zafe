import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: snapshots }, { data: stats }] = await Promise.all([
    supabase
      .from("topic_snapshots")
      .select("prob_sim, volume_sim, volume_nao, recorded_at")
      .eq("topic_id", id)
      .order("recorded_at", { ascending: true })
      .limit(500),
    supabase.from("v_topic_stats").select("*").eq("topic_id", id).single(),
  ]);

  return NextResponse.json({ snapshots: snapshots ?? [], stats });
}
