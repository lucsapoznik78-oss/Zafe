export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, Users } from "lucide-react";

import ComoFunciona from "@/components/escalacao/ComoFunciona";
import MontarTime from "@/components/escalacao/MontarTime";
import SeletorConvocacoes from "@/components/escalacao/SeletorConvocacoes";
import LegalFooter from "@/components/layout/LegalFooter";
import {
  getCardsVigentes,
  getEsportesDoCard,
  getMeuTime,
  getMeusTimes,
  getPool,
  getRanking,
} from "@/lib/escalacao/publico";
import { ESCALACAO_ENABLED } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Escalação — monte seu time e pontue com atletas reais | Zafe",
  description:
    "Monte um time no Brasileirão, na NBA, na NFL, no Valorant ou no mix de UFC, boxe, Fórmula 1 e surf. Cada atleta pontua pelo que fizer de verdade na competição, e os pontos viram Z$.",
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

  const [esportes, pool, time, ranking, meusTimes] = await Promise.all([
    getEsportesDoCard(supabase, card.id),
    getPool(supabase, card.id),
    user ? getMeuTime(supabase, card.id, user.id) : Promise.resolve(null),
    getRanking(supabase, card.id),
    user ? getMeusTimes(supabase, user.id) : Promise.resolve({}),
  ]);

  const nomeDoEsporte = Object.fromEntries(esportes.map((e) => [e.esporte_key, e.nome]));
  const aberto = card.status === "aberto" && new Date(card.fecha_em) > new Date();

  return (
    <div className="py-6 space-y-5">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-primary" /> Escalação
          </h1>
          <p className="text-xs text-muted-foreground">
            Monte um time de atletas reais. Cada um pontua pelo que fizer de verdade na
            competição, e <strong className="text-white">1 ponto = 1 Z$</strong>.
          </p>
        </div>

        {/* O mix junta vários esportes; cada card de modo fixo é uma competição só.
            Lado a lado — e não em abas — porque a pergunta que a página precisa
            responder de cara é "quantos times eu posso ter?". */}
        <SeletorConvocacoes cards={cards} atual={card.id} meusTimes={meusTimes} />

        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-sm font-semibold text-white">{card.titulo}</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip>
              {card.n_titulares} titulares + {card.n_reservas}{" "}
              {card.n_reservas === 1 ? "reserva" : "reservas"}
            </Chip>
            <Chip>
              {card.modo === "mix"
                ? `máx. ${card.teto_por_esporte} por esporte`
                : "posição fixa por vaga"}
            </Chip>
            {card.teto_por_clube !== null && (
              <Chip>máx. {card.teto_por_clube} do mesmo clube</Chip>
            )}
            <Chip>
              {card.modo === "fixo" ? "pontua o mês inteiro" : "um evento por atleta"}
            </Chip>
            <Chip destaque>{card.entrada_z} Z$ de entrada</Chip>
          </div>

          {/* A diferença de cadência entre os dois modos é a coisa que a página
              mais escondia. No mix cada atleta tem um evento no mês; no fixo o
              time trava uma vez e acumula todas as rodadas. */}
          <p className="text-[11px] text-muted-foreground">
            {card.modo === "fixo" ? (
              <>
                É <strong className="text-white">um time só para o mês inteiro</strong>: ele
                trava no fechamento e pontua em{" "}
                <strong className="text-white">todas as partidas</strong> da competição no
                mês. O total é a soma de todas elas.
              </>
            ) : (
              <>
                Cada atleta disputa <strong className="text-white">um evento</strong> no mês —
                a pontuação dele é a desse evento.
              </>
            )}
          </p>

          <p className="text-[11px] text-muted-foreground">
            {esportes.map((e) => e.nome).join(", ")} ·{" "}
            {aberto ? "fecha em " : "fechou em "}
            <strong className="text-white">{FMT_DATA.format(new Date(card.fecha_em))}</strong>
          </p>
        </div>
      </header>

      <ComoFunciona cards={cards} />

      {/* `key={card.id}` não é cosmético. Trocar de Convocação é navegação de
          cliente, e o React reaproveita a instância de `MontarTime` quando só as
          props mudam — os `useState` de titulares/reservas não reinicializam.
          Como Brasileirão e NFL têm os mesmos 11 titulares, o campo parecia
          certo enquanto o banco continuava com os 3 slots do card anterior, e o
          save morria em `too_many` no banco. A chave força remontagem. */}
      {aberto && user && (
        <MontarTime
          key={card.id}
          card={card}
          pool={pool}
          nomeDoEsporte={nomeDoEsporte}
          time={time}
        />
      )}

      {/* Deslogado vê o campo vazio, não um parágrafo. É a vitrine do modo: quem
          chega pelo link (ou pela busca) precisa entender em um olhar que aqui se
          monta um time, não se lê um regulamento. */}
      {aberto && !user && (
        <div className="space-y-3">
          <MontarTime
            key={card.id}
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
          key={card.id}
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

function Chip({ children, destaque }: { children: React.ReactNode; destaque?: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        destaque ? "bg-primary/20 text-primary" : "bg-input text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}
