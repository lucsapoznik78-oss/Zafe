import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: snapshots }, { data: stats }] = await Promise.all([
    admin
      .from("desafio_snapshots")
      .select("prob_sim, volume_sim, volume_nao, recorded_at")
      .eq("desafio_id", id)
      .order("recorded_at", { ascending: true })
      .limit(500),
    admin.from("v_desafio_stats").select("*").eq("desafio_id", id).single(),
  ]);

  return NextResponse.json({ snapshots: snapshots ?? [], stats });
}
