/**
 * Insights Premium por evento (GET).
 *
 * - Premium (isPremium): devolve o conteúdo completo (gera/cacheia se preciso).
 * - Free/anon: devolve { locked:true, teaser } — só a 1ª frase do resumo.
 *   O conteúdo completo NUNCA sai para o free (gate fica aqui, na API).
 *
 * A tabela `topic_insights` tem RLS sem policy de SELECT, então a leitura/escrita
 * usa o service_role (createAdminClient).
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isPremium } from "@/lib/premium";
import { getOrGenerateInsights } from "@/lib/premium/insights";

// Geração on-demand faz web search + 2 chamadas Claude em sequência, o que passa
// do default (~10s) da Vercel. Sem isto a função é morta por timeout e o insight
// nunca é gerado/cacheado. Mesmo padrão de resolver-oracle/resolver-direto.
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const admin = createAdminClient();
  const { data: topic } = await admin
    .from("topics")
    .select("id, title, description, category, closes_at")
    .eq("id", id)
    .maybeSingle();

  if (!topic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let premium = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, premium_until")
      .eq("id", user.id)
      .maybeSingle();
    premium = isPremium(profile);
  }

  const content = await getOrGenerateInsights(admin, topic);
  if (!content) {
    return NextResponse.json(
      { locked: !premium, content: null, teaser: "" },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (premium) {
    return NextResponse.json(
      { locked: false, content },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  // Free/anon: só a 1ª frase do resumo como prévia.
  const teaser = (content.resumo.match(/^[^.!?]+[.!?]?/)?.[0] ?? content.resumo).trim();
  return NextResponse.json(
    { locked: true, teaser },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
