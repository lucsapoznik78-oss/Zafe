/**
 * Cron: Repor eventos expirados automaticamente
 * 
 * Verifica eventos que fecharam há mais de X horas e cria novos eventos
 * para manter a Liga sempre com eventos ativos.
 *
 * Deve ser executado a cada 6 horas.
 */
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const HORAS_EXPIRADO = 6; // Eventos fechados há mais de 6h são repostos
const EVENTOS_POR_EXECUCAO = 5; // Máximo de eventos para criar por vez

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const agora = new Date();
  const limiteExpiracao = new Date(agora.getTime() - HORAS_EXPIRADO * 60 * 60 * 1000);

  let criados = 0;
  let erros = 0;

  try {
    // Buscar eventos expirados da Liga (sem concurso_id)
    const { data: eventosExpiradosLiga } = await supabase
      .from("topics")
      .select("id, title, category, closes_at")
      .eq("status", "resolved")
      .is("concurso_id", null)
      .lt("closes_at", limiteExpiracao.toISOString())
      .order("closes_at", { ascending: false })
      .limit(EVENTOS_POR_EXECUCAO);

    if (eventosExpiradosLiga && eventosExpiradosLiga.length > 0) {
      // Criar novos eventos para a Liga baseados nos templates
      const { data: templates } = await supabase
        .from("topic_templates")
        .select("*")
        .limit(EVENTOS_POR_EXECUCAO);

      if (templates && templates.length > 0) {
        for (const template of templates) {
          try {
            // Verificar se já existe tópico ativo com o mesmo título
            const { data: existingTopic } = await supabase
              .from("topics")
              .select("id")
              .eq("title", template.title)
              .eq("status", "active")
              .is("concurso_id", null)
              .maybeSingle();

            if (existingTopic) {
              console.log(`[repor-eventos] Tópico já existe: ${template.title}. Pulando.`);
              continue;
            }

            const novoClosesAt = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            const { error } = await supabase.from("topics").insert({
              title: template.title,
              description: template.description || "",
              category: template.category,
              closes_at: novoClosesAt.toISOString(),
              status: "active",
              min_bet: 10,
              is_private: false,
              creator_id: process.env.SYSTEM_USER_ID ?? "89aee166-8ccd-4511-8082-8848925d60db",
              total_volume: 0,
              volume_sim: 0,
              volume_nao: 0,
              bet_count: 0,
            });

            if (!error) criados++;
          } catch (e) {
            erros++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      criados,
      erros,
      timestamp: agora.toISOString(),
    });

  } catch (error: any) {
    console.error("[repor-eventos] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno ao repor eventos" },
      { status: 500 }
    );
  }
}
