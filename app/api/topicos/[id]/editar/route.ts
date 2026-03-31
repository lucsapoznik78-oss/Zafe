import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Verificar que é o criador e status = pending
  const { data: topic } = await supabase
    .from("topics")
    .select("creator_id, status")
    .eq("id", id)
    .single();

  if (!topic) return NextResponse.json({ error: "Tópico não encontrado" }, { status: 404 });
  if (topic.creator_id !== user.id) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  if (topic.status !== "pending") return NextResponse.json({ error: "Só é possível editar tópicos aguardando aprovação" }, { status: 400 });

  const { title, description, category, closes_at } = await req.json();
  if (!title || !closes_at) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });

  await supabase
    .from("topics")
    .update({ title, description, category, closes_at })
    .eq("id", id);

  return NextResponse.json({ success: true });
}
