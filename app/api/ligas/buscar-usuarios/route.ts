import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const ligaId = searchParams.get("liga_id") ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });
  if (q.length < 2) return NextResponse.json([]);

  const admin = createAdminClient();

  // Search profiles by username or full_name
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, full_name")
    .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
    .neq("id", user.id)
    .limit(10);

  if (!profiles?.length) return NextResponse.json([]);

  // Filter out users already in the liga
  if (ligaId) {
    const { data: existing } = await admin
      .from("liga_members")
      .select("user_id")
      .eq("liga_id", ligaId)
      .in("user_id", profiles.map((p: any) => p.id));

    const existingIds = new Set((existing ?? []).map((m: any) => m.user_id));
    return NextResponse.json(profiles.filter((p: any) => !existingIds.has(p.id)));
  }

  return NextResponse.json(profiles);
}
