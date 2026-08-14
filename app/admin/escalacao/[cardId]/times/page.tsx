export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ConferirBotao from "@/components/admin/escalacao/ConferirBotao";
import PagarCard from "@/components/admin/escalacao/PagarCard";
import { conferirCard } from "@/lib/escalacao/conferencia";
import { createAdminClient, createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ cardId: string }>;
}

export default async function TimesPage({ params }: Props) {
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

  let conf;
  try {
    conf = await conferirCard(createAdminClient(), cardId);
  } catch {
    notFound();
  }

  const { card, times, totais, problemas } = conf;

  const resumo = [
    ["Times inscritos", `${totais.inscritos}${totais.rascunhos ? ` (+${totais.rascunhos} em rascunho)` : ""}`],
    ["Z$ arrecadado", `${totais.z_debitado_esperado} Z$`],
    ["Pontos somados", totais.pontos.toFixed(1)],
    ["Z$ a emitir", `${totais.z_a_emitir} Z$`],
    ["Teto de emissão", `${card.teto_emissao_z} Z$`],
    ["Saldo do card", `${(totais.z_debitado_esperado - totais.z_a_emitir).toFixed(2)} Z$`],
    ["Pool apurado", `${totais.atletas_no_pool - totais.atletas_sem_pontos}/${totais.atletas_no_pool}`],
  ] as const;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <Link
            href={`/admin/escalacao/${cardId}`}
            className="text-[11px] text-muted-foreground"
          >
            ← {card.titulo}
          </Link>
          <h1 className="text-lg font-bold text-foreground">Inscrições</h1>
        </div>
        <span className="text-xs text-muted-foreground">{card.status}</span>
      </div>

      {/* O par que importa antes de pagar: quanto entrou e quanto sai. Escalação
          é o único módulo que emite Z$ — o saldo negativo aqui é a torneira. */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-foreground">Conferência</h3>
          <ConferirBotao cardId={cardId} />
        </div>
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          {resumo.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd
                className={`text-right tabular-nums ${
                  k === "Z$ a emitir" && totais.estoura_teto ? "text-nao font-bold" : "text-foreground"
                }`}
              >
                {v}
              </dd>
            </div>
          ))}
        </dl>
        {problemas.length > 0 && (
          <ul className="space-y-1 pt-1">
            {problemas.map((p) => (
              <li key={p} className="text-[11px] text-nao">
                {p}
              </li>
            ))}
          </ul>
        )}
        {problemas.length === 0 && totais.inscritos > 0 && (
          <p className="text-[11px] text-sim">Nenhuma inconsistência encontrada.</p>
        )}
      </div>

      {/* Pagar fica DEPOIS da conferência na ordem de leitura porque é a ordem
          da decisão: nada aqui é reversível, e este é o único ponto da
          plataforma que cria Z$. */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Pagamento</h3>
        <PagarCard
          cardId={cardId}
          status={card.status}
          zAEmitir={totais.z_a_emitir}
          estouraTeto={totais.estoura_teto}
          problemas={problemas.length}
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Times ({times.length})</h3>
        {times.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguém inscrito ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {times.map((t, i) => (
              <li key={t.time_id} className="py-2 space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-foreground truncate">
                    <span className="text-muted-foreground">
                      {t.status === "rascunho" ? "—" : `${i + 1}º`}{" "}
                    </span>
                    {t.nome || "(sem nome)"}
                    <span className="text-muted-foreground"> · @{t.username}</span>
                  </span>
                  <span className="text-foreground tabular-nums shrink-0">
                    {t.pontos_total === null ? "—" : t.pontos_total.toFixed(1)} pts
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {t.status} · {t.titulares}+{t.reservas} · pagou {t.entrada_paga} Z$
                  </span>
                  <span className="tabular-nums shrink-0">recebe {t.z_a_emitir} Z$</span>
                </div>
                {t.problemas.map((p) => (
                  <p key={p} className="text-[11px] text-nao">
                    {p}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
