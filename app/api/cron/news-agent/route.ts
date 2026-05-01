/**
 * Cron: Agente de notícias → cria tópicos pendentes automaticamente.
 * Roda diariamente às 8h (Brasília) = 11:00 UTC via GitHub Actions.
 *
 * Requer env: ANTHROPIC_API_KEY, CRON_SECRET, SYSTEM_USER_ID (UUID de um
 * usuário sistema no Supabase — pode ser o admin principal).
 */

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Você é um agente especializado em criar mercados de previsão para a plataforma Zafe (similar ao Polymarket, em pt-BR).

Dado um conjunto de notícias brasileiras recentes, sua tarefa é identificar eventos que possam virar bons mercados de previsão e gerar os dados necessários.

CRITÉRIOS para um bom mercado:
- Resultado BINÁRIO e VERIFICÁVEL (sim ou não, acima/abaixo de X)
- Threshold numérico claro (ex: "O IPCA de maio vai superar 0,5%?") OU fato binário com fonte oficial
- Prazo de resolução realista entre 7 e 60 dias a partir de hoje
- Fonte oficial para verificação (IBGE, TSE, CBF, governo federal, Banco Central, etc.)

PROIBIDO (descarte esses eventos):
- Subjetivos: "vai crescer muito", "será grande", "vai melhorar", "será popular"
- Sem fonte verificável
- Prazo < 7 dias ou > 60 dias
- Duplicatas de tópicos já muito comuns

Retorne SOMENTE um array JSON válido com 5-8 mercados. Cada item deve ter:
{
  "title": "pergunta clara e objetiva (máx 120 chars)",
  "description": "critério de resolução com fonte e threshold exato (máx 500 chars)",
  "category": "politica" | "esportes" | "economia" | "tecnologia" | "entretenimento" | "cultura" | "outros",
  "closes_at": "data ISO 8601 UTC (entre 7 e 60 dias a partir de hoje)"
}

Sem explicações fora do JSON.`;

interface MarketData {
  title: string;
  description: string;
  category: string;
  closes_at: string;
}

export async function POST(request: Request) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const systemUserId = process.env.SYSTEM_USER_ID;
  if (!systemUserId) {
    return NextResponse.json({ error: "SYSTEM_USER_ID env var não configurado" }, { status: 500 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // Claude com web_search para buscar notícias e gerar mercados
    const response = await (client.beta.messages.create as any)({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      betas: ["web-search-2025-03-05"],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Hoje é ${today}. Busque as principais notícias brasileiras dos últimos 2 dias e gere 5-8 mercados de previsão de alta qualidade. Foque em: eleições municipais/estaduais, SELIC e indicadores do Banco Central, IPCA (IBGE), Campeonato Brasileiro, Copa do Brasil, decisões do STF, votações no Congresso, câmbio USD/BRL, PIB, desemprego (PNAD). Seja específico nos thresholds numéricos e fontes.`,
        },
      ],
    });

    // Extrai o texto final da resposta
    let rawText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        rawText = block.text;
        break;
      }
    }

    if (!rawText) {
      return NextResponse.json({ error: "Resposta vazia do Claude" }, { status: 500 });
    }

    // Parse do JSON
    const cleanJson = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let markets: MarketData[];
    try {
      const match = cleanJson.match(/\[[\s\S]*\]/);
      markets = JSON.parse(match ? match[0] : cleanJson);
    } catch (parseErr) {
      console.error("[news-agent] JSON parse error:", cleanJson.slice(0, 300));
      return NextResponse.json({ error: "Falha ao parsear JSON dos mercados" }, { status: 500 });
    }

    if (!Array.isArray(markets) || markets.length === 0) {
      return NextResponse.json({ error: "Nenhum mercado gerado" }, { status: 500 });
    }

    const admin = createAdminClient();
    const inserted: string[] = [];
    const skipped: string[] = [];

    for (const market of markets) {
      if (!market.title || !market.description || !market.closes_at) {
        skipped.push(market.title ?? "sem título");
        continue;
      }

      // Valida a data
      const closesAt = new Date(market.closes_at);
      const now = new Date();
      const diffDays = (closesAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 6 || diffDays > 61) {
        skipped.push(market.title);
        continue;
      }

      const baseSlug = slugify(market.title.trim());
      const suffix = Math.random().toString(36).slice(2, 6);
      const slug = baseSlug ? `${baseSlug}-${suffix}` : suffix;

      const { data, error } = await admin.from("topics").insert({
        creator_id: systemUserId,
        title: market.title.slice(0, 120).trim(),
        description: market.description.slice(0, 500).trim(),
        category: market.category ?? "outros",
        status: "pending",
        min_bet: 1,
        closes_at: closesAt.toISOString(),
        is_private: false,
        slug,
      }).select("id").single();

      if (error) {
        console.error("[news-agent] Insert error:", error.message, market.title);
        skipped.push(market.title);
      } else if (data) {
        inserted.push(data.id);
      }
    }

    console.log(`[news-agent] Inseridos: ${inserted.length}, Pulados: ${skipped.length}`);
    return NextResponse.json({
      success: true,
      inserted: inserted.length,
      skipped: skipped.length,
      skippedTitles: skipped,
    });
  } catch (err: any) {
    console.error("[news-agent] Erro:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
