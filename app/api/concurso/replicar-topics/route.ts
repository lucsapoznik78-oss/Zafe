import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createAdminClient();
  const { concurso_id, category, source_topic_ids } = await request.json();

  if (!concurso_id) {
    return NextResponse.json({ error: "concurso_id é obrigatório" }, { status: 400 });
  }

  // Verifica se o concurso existe
  const { data: concurso } = await supabase
    .from("concursos")
    .select("id, status")
    .eq("id", concurso_id)
    .single();

  if (!concurso) {
    return NextResponse.json({ error: "Concurso não encontrado" }, { status: 404 });
  }

  // Busca topics elegíveis da Liga
  let topicQuery = supabase
    .from("topics")
    .select("*")
    .eq("is_private", false)
    .eq("status", "active")
    .is("concurso_id", null); // Apenas topics da Liga (sem concurso_id)

  if (category) {
    topicQuery = topicQuery.eq("category", category);
  }
  if (source_topic_ids && Array.isArray(source_topic_ids) && source_topic_ids.length > 0) {
    topicQuery = topicQuery.in("id", source_topic_ids);
  }

  const { data: ligaTopics } = await topicQuery;

  if (!ligaTopics || ligaTopics.length === 0) {
    return NextResponse.json({ error: "Nenhum topic elegível encontrado" }, { status: 404 });
  }

  // Clona os topics para o concurso
  const clonedTopics = ligaTopics.map((topic: any) => ({
    ...topic,
    id: undefined, // Gera novo ID
    concurso_id,
    slug: `${topic.slug}-concurso-${concurso_id.slice(0, 8)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data: inserted, error } = await supabase
    .from("topics")
    .insert(clonedTopics)
    .select("id, title");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    cloned_count: inserted?.length ?? 0,
    topics: inserted,
  });
}
