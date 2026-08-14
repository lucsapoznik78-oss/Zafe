export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import CardAcoes from "@/components/admin/escalacao/CardAcoes";
import PoolImport from "@/components/admin/escalacao/PoolImport";
import { createAdminClient, createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ cardId: string }>;
}

export default async function CardPage({ params }: Props) {
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
    .select(
      "id, titulo, modo, mes, status, n_titulares, n_reservas, teto_por_esporte, entrada_z, pontos_por_z, teto_emissao_z, abre_em, fecha_em"
    )
    .eq("id", cardId)
    .single();
  if (!card) notFound();

  const [{ data: esportes }, { data: pool }, { count: times }] = await Promise.all([
    admin
      .from("escalacao_card_esporte")
      .select("esporte_key, regra_id, evento_key, fecha_em")
      .eq("card_id", cardId),
    admin
      .from("escalacao_card_atleta")
      .select("id, esporte_key, competiu, pontos, escalacao_atleta(nome)")
      .eq("card_id", cardId)
      .order("esporte_key"),
    admin
      .from("escalacao_time")
      .select("id", { count: "exact", head: true })
      .eq("card_id", cardId)
      .neq("status", "rascunho"),
  ]);

  const fechado = new Date(card.fecha_em) <= new Date();
  const termos = [
    ["Modo", card.modo],
    ["Mês", card.mes],
    ["Time", `${card.n_titulares} titulares + ${card.n_reservas} reservas`],
    ["Teto por esporte", card.teto_por_esporte],
    ["Entrada", `${Number(card.entrada_z)} Z$`],
    ["Conversão", `1 Z$ por ${Number(card.pontos_por_z)} pontos`],
    ["Teto de emissão", `${Number(card.teto_emissao_z)} Z$`],
    ["Abre", new Date(card.abre_em).toLocaleString("pt-BR")],
    ["Fecha", new Date(card.fecha_em).toLocaleString("pt-BR")],
    ["Times inscritos", times ?? 0],
  ] as const;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <Link href="/admin/escalacao" className="text-[11px] text-muted-foreground">
            ← Escalação
          </Link>
          <h1 className="text-lg font-bold text-foreground">{card.titulo}</h1>
        </div>
        <span className="text-xs text-muted-foreground">{card.status}</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Termos congelados</h3>
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          {termos.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-foreground text-right">{String(v)}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          {(esportes ?? []).map((e) => (
            <span
              key={e.esporte_key}
              className="px-2 py-1 rounded-lg text-[11px] bg-muted text-muted-foreground border border-border"
            >
              {e.esporte_key}
              {e.evento_key ? ` · ${e.evento_key}` : ""}
            </span>
          ))}
        </div>
        {card.status === "rascunho" && <CardAcoes cardId={cardId} acao="publicar" />}
      </div>

      <PoolImport
        cardId={cardId}
        esportes={(esportes ?? []).map((e) => e.esporte_key)}
        bloqueado={fechado}
      />

      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-foreground">Pool ({(pool ?? []).length})</h3>
          <span className="flex items-center gap-3">
            <Link
              href={`/admin/escalacao/${cardId}/times`}
              className="text-xs text-primary hover:underline"
            >
              Inscrições ({times ?? 0}) →
            </Link>
            <Link
              href={`/admin/escalacao/${cardId}/apuracao`}
              className="text-xs text-primary hover:underline"
            >
              Apurar →
            </Link>
          </span>
        </div>
        {(pool ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Pool vazio.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(pool ?? []).map((p) => {
              // O embed vem como objeto ou array dependendo de como o PostgREST
              // enxerga a FK; normalizamos aqui.
              const rel = p.escalacao_atleta as unknown as
                | { nome: string }
                | { nome: string }[]
                | null;
              const nome = Array.isArray(rel) ? rel[0]?.nome : rel?.nome;
              return (
                <li key={p.id} className="py-1.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-foreground">
                    {nome ?? p.id}
                    <span className="text-muted-foreground"> · {p.esporte_key}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {p.competiu === false ? "não competiu" : p.pontos === null ? "—" : Number(p.pontos).toFixed(1)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
