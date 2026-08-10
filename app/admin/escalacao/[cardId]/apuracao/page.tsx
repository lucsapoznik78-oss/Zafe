export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CardAcoes from "@/components/admin/escalacao/CardAcoes";
import StatEntryForm from "@/components/admin/escalacao/StatEntryForm";
import { COLUNAS_REGRA, rulesetDaLinha } from "@/lib/escalacao/apuracao";
import type { Ruleset } from "@/lib/escalacao/rules";
import { createAdminClient, createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ cardId: string }>;
}

export default async function ApuracaoPage({ params }: Props) {
  const { cardId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/liga");

  const admin = createAdminClient();

  const { data: card } = await admin
    .from("escalacao_card")
    .select("id, titulo, status, pontos_por_z, teto_emissao_z")
    .eq("id", cardId)
    .single();
  if (!card) notFound();

  const { data: esportes } = await admin
    .from("escalacao_card_esporte")
    .select("esporte_key, regra_id, evento_key")
    .eq("card_id", cardId);

  const { data: regras } = await admin
    .from("escalacao_regra")
    .select(COLUNAS_REGRA)
    .in("id", (esportes ?? []).map((e) => e.regra_id));

  const rulesetPorId = new Map<string, Ruleset>(
    (regras ?? []).map((r) => [r.id as string, rulesetDaLinha(r)])
  );
  const rulesets: Record<string, Ruleset> = {};
  const eventoPadrao: Record<string, string | null> = {};
  for (const e of esportes ?? []) {
    const rs = rulesetPorId.get(e.regra_id);
    if (rs) rulesets[e.esporte_key] = rs;
    eventoPadrao[e.esporte_key] = e.evento_key;
  }

  const [{ data: pool }, { data: ranking }] = await Promise.all([
    admin
      .from("escalacao_card_atleta")
      .select("id, esporte_key, escalacao_atleta(nome)")
      .eq("card_id", cardId)
      .order("esporte_key"),
    admin
      .from("v_escalacao_ranking")
      .select("posicao, username, nome, pontos_total")
      .eq("card_id", cardId)
      .order("posicao")
      .limit(50),
  ]);

  const atletas = (pool ?? []).map((p) => {
    const rel = p.escalacao_atleta as unknown as { nome: string } | { nome: string }[] | null;
    return {
      id: p.id as string,
      nome: (Array.isArray(rel) ? rel[0]?.nome : rel?.nome) ?? (p.id as string),
      esporte_key: p.esporte_key as string,
    };
  });

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <Link href={`/admin/escalacao/${cardId}`} className="text-[11px] text-muted-foreground">
          ← {card.titulo}
        </Link>
        <h1 className="text-lg font-bold text-white">Apuração</h1>
        <p className="text-[11px] text-muted-foreground">
          1 Z$ por {Number(card.pontos_por_z)} pontos · teto de emissão{" "}
          {Number(card.teto_emissao_z)} Z$
        </p>
      </div>

      {/* A apuração por IA fica em /admin/escalacao, com seletor de card: é a
          tarefa mais frequente e não devia exigir navegar até aqui. Esta página
          é o lançamento manual — a correção de um caso que a IA errou. */}
      <p className="text-[11px] text-muted-foreground">
        Lançamento manual.{" "}
        <Link href="/admin/escalacao" className="text-primary hover:underline">
          Apurar com IA →
        </Link>
      </p>

      {atletas.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Importe o pool antes de lançar stats.
        </p>
      ) : (
        <StatEntryForm
          cardId={cardId}
          atletas={atletas}
          rulesets={rulesets}
          eventoPadrao={eventoPadrao}
        />
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <CardAcoes cardId={cardId} acao="recalcular" />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-white">Ranking</h3>
        {(ranking ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum time apurado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(ranking ?? []).map((r) => (
              <li
                key={`${r.posicao}-${r.username}`}
                className="py-1.5 flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="text-white">
                  {r.posicao}. {r.nome ?? r.username}
                  <span className="text-muted-foreground"> @{r.username}</span>
                </span>
                <span className="text-white tabular-nums">
                  {r.pontos_total === null ? "—" : Number(r.pontos_total).toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
