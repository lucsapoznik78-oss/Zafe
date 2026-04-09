import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Missing env vars", url: !!url, key: !!key });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from("topics")
    .select("id")
    .eq("is_private", false)
    .eq("status", "active")
    .limit(5);

  return NextResponse.json({ count: data?.length ?? 0, error: error?.message ?? null });
}
