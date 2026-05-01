import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("ligas")
    .select("id, name, description, color, creator_id, is_public, liga_members(id, status)")
    .eq("is_public", true)
    .is("parent_liga_id", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (q.trim()) {
    query = query.ilike("name", `%${q.trim()}%`);
  }

  const { data: ligas } = await query;

  // Filter out leagues the user is already in
  const userLigaIds = user
    ? await supabase
        .from("liga_members")
        .select("liga_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .then(({ data }) => new Set((data ?? []).map((m: any) => m.liga_id)))
    : new Set<string>();

  const result = (ligas ?? [])
    .filter((l: any) => !userLigaIds.has(l.id))
    .map((l: any) => ({
      ...l,
      member_count: (l.liga_members ?? []).filter((m: any) => m.status === "active").length,
      liga_members: undefined,
    }));

  return NextResponse.json(result);
}
