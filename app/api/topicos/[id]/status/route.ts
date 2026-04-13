import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("topics")
    .select("status, resolution, resolved_at")
    .eq("id", id)
    .single();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
