/**
 * Resolve um mercado diretamente via Claude com web search.
 * Usado quando o oracle automático falha por timeout.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { pagarVencedores, reembolsarTodos } from "@/lib/payout";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();

  // Busca todos os tópicos expirados (active ou resolving)
  const now = new Date().toISOString();
  const { data: expired } = await admin
    .from("topics")
    .select("id, title, category, closes_at, status")
    .or(`status.eq.resolving,and(status.eq.active,closes_at.lt.${now})`)
    .eq("is_private", false);

  if (!expired || expired.length === 0) {
    return NextResponse.json({ message: "Nenhum mercado expirado encontrado", resolved: 0 });
  }

  // Move qualquer active expirado para resolving
  const activeExpired = expired.filter(t => t.status === "active");
  if (activeExpired.length > 0) {
    await admin.from("topics")
      .update({ status: "resolving", oracle_retry_count: 0, oracle_next_retry_at: null })
      .in("id", activeExpired.map(t => t.id));
  }

  const results: { title: string; outcome: string }[] = [];

  for (const topic of expired) {
    try {
      const prazo = new Date(topic.closes_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const prompt = `Você é o oracle de um site de prediction markets brasileiro chamado Zafe.

Pergunta do mercado: "${topic.title}"
Prazo: ${prazo} (horário de Brasília)
Data atual: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}

Use busca na web para verificar se o evento aconteceu antes do prazo indicado.

Responda SOMENTE com JSON (sem markdown, sem texto extra):
{"resultado":"SIM","confianca":95}
ou
{"resultado":"NAO","confianca":95}
ou
{"resultado":"INCERTO","confianca":0}

IMPORTANTE: Prefira SIM ou NAO a INCERTO sempre que encontrar qualquer evidência.`;

      // Tenta com web search primeiro
      let response;
      try {
        response = await claude.messages.create(
          {
            model: "claude-haiku-4-5-20251001",
            max_tokens: 300,
            tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
            messages: [{ role: "user", content: prompt }],
          },
          { headers: { "anthropic-beta": "web-search-2025-03-05" } }
        );
      } catch {
        // Fallback sem web search
        response = await claude.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        });
      }

      const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
      const text = textBlock?.text ?? "";
      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let parsed: any;
      try { parsed = JSON.parse(clean); } catch { const m = clean.match(/\{[\s\S]*\}/); try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; } }

      if (!parsed || !["SIM","NAO","INCERTO"].includes(parsed.resultado)) {
        results.push({ title: topic.title, outcome: "parse_error" });
        continue;
      }

      if (parsed.resultado === "INCERTO") {
        results.push({ title: topic.title, outcome: "incerto" });
        continue;
      }

      const resolucao = parsed.resultado.toLowerCase() as "sim" | "nao";
      await admin.from("resolucoes").insert({
        mercado_id: topic.id,
        resolvido_por: "oracle_ai_direto",
        oracle_usado: "claude-haiku-4-5-20251001",
        numero_tentativa: 1,
        resultado_final: parsed.resultado,
      });

      await pagarVencedores(admin, topic.id, resolucao, user.id);
      results.push({ title: topic.title, outcome: parsed.resultado });

    } catch (err) {
      results.push({ title: topic.title, outcome: `erro: ${String(err).slice(0, 100)}` });
    }
  }

  return NextResponse.json({ resolved: results.filter(r => r.outcome === "SIM" || r.outcome === "NAO").length, total: expired.length, results });
}
