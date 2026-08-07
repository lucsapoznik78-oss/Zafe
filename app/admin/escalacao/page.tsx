export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import CardForm from "@/components/admin/escalacao/CardForm";
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

  const [{ data: cards }, { data: regras }, { data: competicoes }] = await Promise.all([
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
  ]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Escalação</h1>
        <p className="text-xs text-muted-foreground">
          Convocações mensais em Z$. Apuração manual — nenhum cron depende disto.
        </p>
      </div>

      <CardForm regras={regras ?? []} competicoes={competicoes ?? []} />

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {(cards ?? []).length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">Nenhum card ainda.</p>
        ) : (
          (cards ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/admin/escalacao/${c.id}`}
              className="block p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-white">{c.titulo}</span>
                <span className={`text-[11px] ${CORES[c.status] ?? "text-white"}`}>{c.status}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {c.modo} · {c.mes} · {c.n_titulares} titulares · entrada {Number(c.entrada_z)} Z$ ·
                fecha {new Date(c.fecha_em).toLocaleString("pt-BR")}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
