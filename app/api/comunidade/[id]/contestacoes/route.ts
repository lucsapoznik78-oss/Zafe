import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("community_contestations")
    .select("*, user:profiles!user_id(username, full_name)")
    .eq("event_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Erro ao buscar contestações" }, { status: 500 });
  return NextResponse.json(data ?? []);
}
