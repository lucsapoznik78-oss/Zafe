import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { title, description, category, closes_at, min_bet } = body;

  if (!title?.trim() || !description?.trim() || !closes_at) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatórios" }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: "Título muito longo (máx 120 caracteres)" }, { status: 400 });
  }
  if (description.length > 800) {
    return NextResponse.json({ error: "Descrição muito longa (máx 800 caracteres)" }, { status: 400 });
  }

  const closesDate = new Date(closes_at);
  if (isNaN(closesDate.getTime()) || closesDate <= new Date()) {
    return NextResponse.json({ error: "Data de encerramento inválida ou no passado" }, { status: 400 });
  }

  // Prazo de prova: 48h após fechamento
  const proofDeadline = new Date(closesDate.getTime() + 48 * 60 * 60 * 1000);

  const { data, error } = await supabase.from("desafios").insert({
    creator_id: user.id,
    title: title.trim(),
    description: description.trim(),
    category: category ?? "outros",
    closes_at: closesDate.toISOString(),
    min_bet: parseFloat(min_bet ?? "1") || 1,
    proof_deadline_at: proofDeadline.toISOString(),
  }).select("id").single();

  if (error) {
    console.error("[desafios/criar]", error);
    return NextResponse.json({ error: "Erro ao criar desafio" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
