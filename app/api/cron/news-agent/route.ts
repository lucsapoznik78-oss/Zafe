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

const SYSTEM_PROMPT = `Você é um agente especializado em criar eventos de fantasy sport (esporte e e-sports) para a plataforma Zafe (pt-BR).

Sua tarefa: gerar eventos ESPORTIVOS ou de E-SPORTS que um sistema de IA com busca na web CONSIGA resolver com certeza consultando fontes públicas.

REGRA DE OURO: só crie o evento se você mesmo, agora, já soubesse responder SIM ou NAO com alta confiança usando uma busca rápida. Se a resposta depende de opinião, interpretação ou não tem fonte oficial clara → DESCARTE.

ESCOPO OBRIGATÓRIO: somente esporte (futebol, UFC, NBA, F1, vôlei, tênis…) e e-sports (CS2, LoL, Valorant, EA FC, Dota 2…). NUNCA política, economia, tecnologia, entretenimento ou cultura.

TIPOS PERMITIDOS (exemplos reais):
✅ "O Flamengo vai vencer o Fluminense no Brasileirão no dia 15/05?" — fonte: cbf.com.br, resultado publicado após o jogo
✅ "O Brasil vai ganhar da Argentina no dia X?" — fonte: resultado do jogo
✅ "Charles do Bronx vence por finalização no UFC 320?" — fonte: ufc.com, resultado pós-luta
✅ "A LOUD vence a paiN na semifinal do CBLOL no dia X?" — fonte: resultado oficial da liga
✅ "A FURIA passa de fase no Major de CS2?" — fonte: HLTV/resultado oficial

TIPOS PROIBIDOS (exemplos):
❌ Qualquer evento de política, economia, tecnologia, entretenimento ou cultura
❌ "Time X joga bem no fim de semana?" — subjetivo, sem placar
❌ "e-Sport brasileiro cresce em 2026?" — vago, sem evento/data

OBRIGATÓRIO em cada mercado:
- Entidade específica nomeada (time, atleta, organização de e-sports, partida)
- Resultado binário com data fixa de jogo/partida
- Fonte oficial explícita na descrição (cbf.com.br, ufc.com, HLTV, liga oficial, etc.)

Retorne SOMENTE um array JSON com 5-8 mercados:
{
  "title": "pergunta objetiva com entidade nomeada (máx 120 chars)",
  "description": "critério exato de resolução + fonte (máx 500 chars)",
  "category": "esportes" | "esports",
  "closes_at": "data ISO 8601 UTC (entre 7 e 60 dias a partir de hoje)"
}

Sem texto fora do JSON.`;

interface MarketData {
  title: string;
  description: string;
  category: string;
  closes_at: string;
}

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

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
          content: `Hoje é ${today}. Busque os principais jogos e partidas de esporte e e-sports dos próximos 7 a 60 dias e gere 5-8 mercados de previsão binários (SIM/NAO) de alta qualidade. Foque em: Campeonato Brasileiro, Copa do Brasil, Libertadores, UFC, NBA, F1, futebol europeu, e em e-sports (CS2 — Majors/HLTV, LoL — CBLOL/Worlds, Valorant — VCT, Dota 2, EA FC). Cada mercado precisa de uma partida/evento real com data confirmada, entidade nomeada e fonte oficial. NUNCA política, economia, tecnologia, entretenimento ou cultura.`,
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
        category: market.category === "esports" ? "esports" : "esportes",
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
