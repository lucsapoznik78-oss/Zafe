import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { executePalpitar } from "@/lib/apostar";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { side, amount } = await request.json();
  return executePalpitar(supabase, user.id, params.id, side, amount);
}
