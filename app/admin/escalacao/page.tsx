export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import CardForm from "@/components/admin/escalacao/CardForm";
import PesquisaIA, { type CardOpcao } from "@/components/admin/escalacao/PesquisaIA";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const CORES: Record<string, string> = {
  rascunho: "text-muted-foreground",
  aberto: "text-sim",
  fechado: "text-white",
  apurando: "text-white",
  apurado: "text-white",
  pago: "text-sim",
  cancelado: "text-nao",
};

export default async function EscalacaoAdminPage() {
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

  const [
    { data: cards },
    { data: regras },
    { data: competicoes },
    { data: cardEsportes },
    { data: poolTodo },
    { data: timesTodos },
  ] = await Promise.all([
    admin
      .from("escalacao_card")
      .select("id, titulo, modo, mes, status, entrada_z, n_titulares, fecha_em")
      .order("mes", { ascending: false }),
    admin
      .from("escalacao_regra")
      .select("id, esporte_key, versao, ev_alvo")
      .order("esporte_key")
      .order("versao", { ascending: false }),
    admin.from("escalacao_competicao").select("id, slug, nome").eq("ativo", true).order("nome"),
    admin
      .from("escalacao_card_esporte")
      .select("card_id, esporte_key, evento_key, escalacao_esporte(nome)"),
    // O pool inteiro de todos os cards em uma query: são centenas de linhas, não
    // milhares, e um count por (card, esporte) sairia caro em ida e volta.
    admin.from("escalacao_card_atleta").select("card_id, esporte_key, pontos"),
    admin.from("escalacao_time").select("card_id, status"),
  ]);

  const progresso = new Map<string, { total: number; comNota: number }>();
  for (const a of poolTodo ?? []) {
    const chave = `${a.card_id}|${a.esporte_key}`;
    const acc = progresso.get(chave) ?? { total: 0, comNota: 0 };
    acc.total++;
    if (a.pontos !== null) acc.comNota++;
    progresso.set(chave, acc);
  }

  const inscritosPorCard = new Map<string, number>();
  for (const t of timesTodos ?? []) {
    if (t.status === "rascunho") continue;
    inscritosPorCard.set(t.card_id, (inscritosPorCard.get(t.card_id) ?? 0) + 1);
  }

  const esportesPorCard = new Map<string, CardOpcao["esportes"]>();
  for (const ce of cardEsportes ?? []) {
    const rel = ce.escalacao_esporte as unknown as { nome: string } | { nome: string }[] | null;
    const chave = `${ce.card_id}|${ce.esporte_key}`;
    const p = progresso.get(chave) ?? { total: 0, comNota: 0 };
    const lista = esportesPorCard.get(ce.card_id) ?? [];
    lista.push({
      key: ce.esporte_key,
      nome: (Array.isArray(rel) ? rel[0]?.nome : rel?.nome) ?? ce.esporte_key,
      evento_key: ce.evento_key,
      total: p.total,
      comNota: p.comNota,
    });
    esportesPorCard.set(ce.card_id, lista);
  }

  // A ordem do seletor é a ordem em que o trabalho aparece: o que já fechou e
  // ainda tem atleta sem nota vem primeiro. Card sem pool não entra — não há o
  // que a IA pesquisar.
  const agora = Date.now();
  const paraApurar: CardOpcao[] = (cards ?? [])
    .filter((c) => c.status !== "rascunho" && c.status !== "cancelado")
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      status: c.status,
      esportes: (esportesPorCard.get(c.id) ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
    }))
    .filter((c) => c.esportes.some((e) => e.total > 0))
    .sort((a, b) => {
      const cardA = (cards ?? []).find((c) => c.id === a.id)!;
      const cardB = (cards ?? []).find((c) => c.id === b.id)!;
      const pesoA = new Date(cardA.fecha_em).getTime() <= agora ? 0 : 1;
      const pesoB = new Date(cardB.fecha_em).getTime() <= agora ? 0 : 1;
      if (pesoA !== pesoB) return pesoA - pesoB;
      return new Date(cardA.fecha_em).getTime() - new Date(cardB.fecha_em).getTime();
    });

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <Link href="/admin" className="text-[11px] text-muted-foreground">
          ← Painel
        </Link>
        <h1 className="text-lg font-bold text-white">Escalação</h1>
        <p className="text-xs text-muted-foreground">
          Dar nota aos atletas é o trabalho principal daqui. Nenhum cron faz isso — a apuração
          só acontece quando você roda.
        </p>
      </div>

      <PesquisaIA cards={paraApurar} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white">Convocações</h2>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {(cards ?? []).length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">Nenhum card ainda.</p>
          ) : (
            (cards ?? []).map((c) => {
              const esportes = esportesPorCard.get(c.id) ?? [];
              const total = esportes.reduce((s, e) => s + e.total, 0);
              const comNota = esportes.reduce((s, e) => s + e.comNota, 0);
              const fechado = new Date(c.fecha_em).getTime() <= agora;
              return (
                <Link
                  key={c.id}
                  href={`/admin/escalacao/${c.id}`}
                  className="block p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-white">{c.titulo}</span>
                    <span className={`text-[11px] ${CORES[c.status] ?? "text-white"}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {c.modo} · {inscritosPorCard.get(c.id) ?? 0} inscritos · pool {comNota}/
                    {total} com nota · {fechado ? "fechou" : "fecha"}{" "}
                    {new Date(c.fecha_em).toLocaleString("pt-BR")}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <details className="bg-card border border-border rounded-xl p-4">
        <summary className="text-sm font-semibold text-white cursor-pointer">
          Criar convocação
        </summary>
        <div className="pt-3">
          <CardForm regras={regras ?? []} competicoes={competicoes ?? []} />
        </div>
      </details>
    </div>
  );
}
