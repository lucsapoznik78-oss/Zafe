import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { slugify } from "@/lib/slugify";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { title, description, category, closes_at, min_bet } = await request.json();

  if (!title || !description || !closes_at) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  if (new Date(closes_at) <= new Date()) {
    return NextResponse.json({ error: "Data de encerramento inválida" }, { status: 400 });
  }

  // Gera slug único
  const baseSlug = slugify(title.trim());
  const suffix = Math.random().toString(36).slice(2, 6);
  const slug = baseSlug ? `${baseSlug}-${suffix}` : suffix;

  const { data, error } = await supabase.from("topics").insert({
    creator_id: user.id,
    title: title.trim(),
    description: description.trim(),
    category: category ?? "outros",
    status: "pending",
    min_bet: parseFloat(min_bet) || 1,
    closes_at: new Date(closes_at).toISOString(),
    is_private: false,
    slug,
  }).select().single();

  if (error) return NextResponse.json({ error: "Erro ao criar tópico" }, { status: 500 });

  return NextResponse.json({ success: true, topic: data });
}
