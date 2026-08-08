export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, Users } from "lucide-react";

import MontarTime from "@/components/escalacao/MontarTime";
import LegalFooter from "@/components/layout/LegalFooter";
import {
  getCardsVigentes,
  getEsportesDoCard,
  getMeuTime,
  getPool,
  getRanking,
} from "@/lib/escalacao/publico";
import { ESCALACAO_ENABLED } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Escalação — monte seu time e pontue com atletas reais | Zafe",
  description:
    "Escale atletas de UFC, boxe, Fórmula 1 e surf num time só. Cada atleta pontua pelo que fizer de verdade na competição, e os pontos viram Z$.",
  alternates: { canonical: "/escalacao" },
};

const FMT_DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export default async function EscalacaoPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  if (!ESCALACAO_ENABLED) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cards = await getCardsVigentes(supabase);
  if (cards.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <h1 className="text-xl font-bold text-white">Escalação</h1>
        <p className="text-sm text-muted-foreground">
          Nenhuma Convocação aberta agora. A próxima abre no começo do mês.
        </p>
      </div>
    );
  }

  const card = cards.find((c) => c.id === searchParams.c) ?? cards[0];

  const [esportes, pool, time, ranking] = await Promise.all([
    getEsportesDoCard(supabase, card.id),
    getPool(supabase, card.id),
    user ? getMeuTime(supabase, card.id, user.id) : Promise.resolve(null),
    getRanking(supabase, card.id),
  ]);

  const nomeDoEsporte = Object.fromEntries(esportes.map((e) => [e.esporte_key, e.nome]));
  const aberto = card.status === "aberto" && new Date(card.fecha_em) > new Date();

  return (
    <div className="py-6 space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users size={20} className="text-primary" /> Escalação
        </h1>

        {/* Seletor de Convocação. O mix junta vários esportes; cada card de modo
            fixo é uma competição só. Some quando só existe uma. */}
        {cards.length > 1 && (
          <nav className="flex flex-wrap gap-1.5" aria-label="Convocações">
            {cards.map((c) => (
              <Link
                key={c.id}
                href={`/escalacao?c=${c.id}`}
                aria-current={c.id === card.id ? "page" : undefined}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  c.id === card.id
                    ? "bg-primary text-white"
                    : "bg-input text-muted-foreground hover:text-white"
                }`}
              >
                {c.modo === "mix" ? "Mix" : c.titulo}
              </Link>
            ))}
          </nav>
        )}

        <p className="text-sm font-semibold text-white">{card.titulo}</p>
        <p className="text-xs text-muted-foreground">
          Escale {card.n_titulares} titulares e {card.n_reservas} reservas entre atletas de{" "}
          {esportes.map((e) => e.nome).join(", ")}. No máximo {card.teto_por_esporte} por
          esporte. Cada atleta pontua pelo que fizer de verdade, e 1 ponto = 1 Z$.
        </p>
        <p className="text-xs text-muted-foreground">
          {aberto ? "Fecha em " : "Fechou em "}
          <strong className="text-white">{FMT_DATA.format(new Date(card.fecha_em))}</strong> ·
          entrada de <strong className="text-white">{card.entrada_z} Z$</strong>
        </p>
      </header>

      {aberto && user && (
        <MontarTime card={card} pool={pool} nomeDoEsporte={nomeDoEsporte} time={time} />
      )}

      {/* Deslogado vê o campo vazio, não um parágrafo. É a vitrine do modo: quem
          chega pelo link (ou pela busca) precisa entender em um olhar que aqui se
          monta um time, não se lê um regulamento. */}
      {aberto && !user && (
        <div className="space-y-3">
          <MontarTime
            card={card}
            pool={pool}
            nomeDoEsporte={nomeDoEsporte}
            time={null}
            somenteLeitura
          />
          <Link
            href="/login"
            className="block w-full py-2.5 bg-primary text-white font-bold text-sm rounded-xl text-center hover:bg-primary/90 transition-colors"
          >
            Entrar para escalar
          </Link>
        </div>
      )}

      {/* Fechada: quem escalou continua vendo o próprio campo, agora só leitura. */}
      {!aberto && time && (
        <MontarTime
          card={card}
          pool={pool}
          nomeDoEsporte={nomeDoEsporte}
          time={time}
          somenteLeitura
        />
      )}

      {!aberto && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <Trophy size={15} className="text-primary" /> Ranking
          </h2>
          {ranking.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ainda sem times apurados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {ranking.map((l) => (
                <li key={l.time_id} className="flex items-center gap-3 py-2">
                  <span className="text-xs text-muted-foreground w-6 shrink-0">{l.posicao}º</span>
                  <span className="flex-1 text-sm text-white truncate">
                    {l.nome || l.username}
                  </span>
                  <span className="text-sm text-white shrink-0">
                    {l.pontos_total ?? 0} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Como cada esporte pontua</h2>
        {esportes.map((e) => (
          <div key={e.esporte_key} className="space-y-1">
            <p className="text-xs font-semibold text-white">{e.nome}</p>
            <ul className="space-y-0.5">
              {e.regras.map((r, i) => (
                <li key={i} className="text-[11px] text-muted-foreground">
                  {r.rotulo}
                  {r.resumo && <span className="text-white"> — {r.resumo}</span>}
                </li>
              ))}
            </ul>
            {e.fecha_em && (
              <p className="text-[11px] text-muted-foreground">
                Prazo próprio: {FMT_DATA.format(new Date(e.fecha_em))}
              </p>
            )}
          </div>
        ))}
      </section>

      <LegalFooter />
    </div>
  );
}
