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
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Users size={20} className="text-primary" /> Escalação
        </h1>
        <p className="text-xs text-muted-foreground">
          Monte um time de atletas reais. Cada um pontua pelo que fizer de verdade na
          competição, e <strong className="text-white">1 ponto = 1 Z$</strong>.
        </p>
      </header>

      {/* O mix junta vários esportes; cada card de modo fixo é uma competição só.
          Lado a lado — e não em abas — porque a pergunta que a página precisa
          responder de cara é "quantos times eu posso ter?". */}
      <SeletorConvocacoes cards={cards} atual={card.id} meusTimes={meusTimes} />

      {/* Uma linha, não seis. O que o usuário precisa saber antes de escalar é
          preço, tamanho do time e prazo; o resto (cadência, tetos, pontuação de
          cada esporte) desceu para o `<details>` de regras lá embaixo, onde só
          quem procura paga o custo de ler. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-base font-bold text-white">{card.titulo}</h2>
        <p className="text-[11px] text-muted-foreground">
          {card.n_titulares}+{card.n_reservas} · {card.entrada_z} Z$ ·{" "}
          {aberto ? "fecha " : "fechou "}
          <strong className="text-white">{FMT_DATA.format(new Date(card.fecha_em))}</strong>
        </p>
      </div>

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
                  <span className="text-right shrink-0">
                    <span className="block text-sm text-white">{l.pontos_total ?? 0} pts</span>
                    {/* Só existe depois de `escalacao_pagar_card`. Antes disso o
                        valor é uma projeção, e mostrar projeção de Z$ como se
                        fosse saldo é promessa que o card ainda pode não cumprir. */}
                    {l.premio_z !== null && (
                      <span className="block text-[11px] text-sim">
                        +{Number(l.premio_z)} Z$
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Tutorial e regulamento viram opt-in. Estavam sempre abertos, acima do
          campo, e empurravam o produto para baixo da dobra — quem já entendeu o
          modo lia tudo de novo toda visita. */}
      <details className="bg-card border border-border rounded-xl">
        <summary className="p-4 text-sm font-semibold text-white cursor-pointer">
          Como funciona
        </summary>
        <div className="px-4 pb-4">
          <ComoFunciona cards={cards} />
        </div>
      </details>

      <details className="bg-card border border-border rounded-xl">
        <summary className="p-4 text-sm font-semibold text-white cursor-pointer">
          Regras desta Convocação
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <ul className="space-y-0.5">
            <Regra>
              {card.n_titulares} titulares + {card.n_reservas}{" "}
              {card.n_reservas === 1 ? "reserva" : "reservas"}
            </Regra>
            <Regra>
              {card.modo === "mix"
                ? `Máximo de ${card.teto_por_esporte} atletas por esporte`
                : "Cada vaga aceita só atletas da posição dela"}
            </Regra>
            {card.teto_por_clube !== null && (
              <Regra>Máximo de {card.teto_por_clube} atletas do mesmo clube</Regra>
            )}
            <Regra>
              {card.modo === "fixo"
                ? "Um time só para o mês inteiro: trava no fechamento e pontua em todas as partidas da competição no mês."
                : "Cada atleta disputa um evento no mês — a pontuação dele é a desse evento."}
            </Regra>
            <Regra>Entrada de {card.entrada_z} Z$, debitada ao se inscrever</Regra>
          </ul>

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
        </div>
      </details>

      <LegalFooter />
    </div>
  );
}

function Regra({ children }: { children: React.ReactNode }) {
  return <li className="text-[11px] text-muted-foreground">· {children}</li>;
}
