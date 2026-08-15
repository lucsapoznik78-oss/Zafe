"use client";

import { useState } from "react";
import { ArrowRight, Check, Coins, Play, X } from "lucide-react";

import type { CardPublico } from "@/lib/escalacao/publico";

/**
 * O tutorial do modo, jogável em vez de lido.
 *
 * A página já explicava as regras em prosa e ninguém lia: as duas coisas que o
 * usuário mais erra — que dá para ter um time em cada Convocação, e que um slot
 * de goleiro só aceita goleiro — são exatamente as que um parágrafo não ensina.
 * Aqui ele **tenta** escalar um zagueiro no gol e leva a recusa; é o mesmo erro
 * que o banco devolveria, só que barato e antes de gastar Z$.
 *
 * Os dados do passo 1 são as Convocações reais; os dos passos 2 e 3 são fixos, de
 * demonstração — o tutorial não deve depender do pool nem sobreviver a ele.
 */

const PASSOS = ["Escolha", "Escale", "Pontue"] as const;

interface Candidato {
  nome: string;
  pos: string;
  clube: string;
}

const DEMO: Array<{ rotulo: string; candidatos: Candidato[] }> = [
  {
    rotulo: "GOL",
    candidatos: [
      { nome: "Hugo Souza", pos: "GOL", clube: "Corinthians" },
      { nome: "Thiago Silva", pos: "ZAG", clube: "Fluminense" },
    ],
  },
  {
    rotulo: "MEI",
    candidatos: [
      { nome: "Arrascaeta", pos: "MEI", clube: "Flamengo" },
      { nome: "Weverton", pos: "GOL", clube: "Palmeiras" },
    ],
  },
  {
    rotulo: "ATA",
    candidatos: [
      { nome: "Pedro", pos: "ATA", clube: "Flamengo" },
      { nome: "Alex Telles", pos: "LAT", clube: "Botafogo" },
    ],
  },
];

/** Os valores são os de `futebol.v2` — a demonstração não pode mentir a escala. */
const LANCES = [
  { texto: "Time venceu", pts: 6 },
  { texto: "Gol", pts: 10 },
  { texto: "Assistência", pts: 5 },
  { texto: "Cartão vermelho", pts: -4 },
];

export default function ComoFunciona({ cards }: { cards: CardPublico[] }) {
  const [passo, setPasso] = useState(0);

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground flex-1">Como funciona</h2>
        {PASSOS.map((p, i) => (
          <button
            key={p}
            onClick={() => setPasso(i)}
            aria-current={i === passo ? "step" : undefined}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              i === passo
                ? "bg-primary text-primary-foreground"
                : "bg-input text-muted-foreground hover:text-foreground"
            }`}
          >
            {i + 1}. {p}
          </button>
        ))}
      </header>

      <div className="p-4 min-h-[13.5rem] flex flex-col">
        {passo === 0 && <PassoEscolha cards={cards} />}
        {passo === 1 && <PassoEscale />}
        {passo === 2 && <PassoPontue />}

        {passo < PASSOS.length - 1 && (
          <button
            onClick={() => setPasso(passo + 1)}
            className="mt-4 self-start inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {PASSOS[passo + 1]} <ArrowRight size={13} />
          </button>
        )}
      </div>
    </section>
  );
}

/** Passo 1 — a regra que ninguém adivinha: são N times, não um. */
function PassoEscolha({ cards }: { cards: CardPublico[] }) {
  const [i, setI] = useState(0);
  const c = cards[Math.min(i, cards.length - 1)];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Cada Convocação é uma competição e tem o próprio time, a própria entrada e o
        próprio ranking. Você pode entrar em{" "}
        <strong className="text-foreground">todas as {cards.length}</strong> — são{" "}
        {cards.length} times seus, não um.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {cards.map((card, idx) => (
          <button
            key={card.id}
            onClick={() => setI(idx)}
            // Pill ativa: `text-background`, não `text-primary-foreground`. A
            // pill é clara nos dois temas e no `legacy` o on-accent é branco —
            // daria branco sobre branco.
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              idx === i ? "bg-foreground text-background" : "bg-input text-muted-foreground hover:text-foreground"
            }`}
          >
            {card.modo === "mix" ? "Mix" : card.titulo.split(" — ")[0]}
          </button>
        ))}
      </div>

      {c && (
        <div className="rounded-xl bg-input/60 border border-border p-3 space-y-1">
          <p className="text-xs font-semibold text-foreground">{c.titulo}</p>
          <p className="text-[11px] text-muted-foreground">
            {c.n_titulares} titulares e {c.n_reservas}{" "}
            {c.n_reservas === 1 ? "reserva" : "reservas"} ·{" "}
            {c.modo === "mix"
              ? `atletas de ${c.esportes.length} esportes, no máximo ${c.teto_por_esporte} de cada`
              : "cada posição só aceita quem joga nela"}
            {c.teto_por_clube !== null && `, no máximo ${c.teto_por_clube} do mesmo clube`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {c.modo === "fixo" ? (
              <>
                Um time <strong className="text-foreground">para o mês inteiro</strong>: trava no
                fechamento e pontua em todas as partidas do mês, somadas.
              </>
            ) : (
              <>
                Cada atleta disputa <strong className="text-foreground">um evento</strong> no mês.
              </>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Entrada de <strong className="text-foreground">{c.entrada_z} Z$</strong>, debitada na
            inscrição.
          </p>
        </div>
      )}
    </div>
  );
}

/** Passo 2 — errar de propósito ensina a regra de posição em um toque. */
function PassoEscale() {
  const [escolhidos, setEscolhidos] = useState<Array<Candidato | null>>([null, null, null]);
  const [aberto, setAberto] = useState<number | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);

  function tentar(idx: number, c: Candidato) {
    if (c.pos !== DEMO[idx].rotulo) {
      setRecusa(`${c.nome} joga de ${c.pos} — esta vaga é de ${DEMO[idx].rotulo}.`);
      return;
    }
    setEscolhidos((atual) => atual.map((v, i) => (i === idx ? c : v)));
    setAberto(null);
    setRecusa(null);
  }

  const completo = escolhidos.every(Boolean);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Toque numa vaga e escolha o atleta. Nas ligas com posição, o gol só aceita goleiro
        — tente furar a regra abaixo.
      </p>

      <div className="rounded-xl bg-gradient-to-b from-emerald-800 to-emerald-950 border border-foreground/10 p-3 flex justify-center gap-3">
        {DEMO.map((slot, idx) => {
          const escolhido = escolhidos[idx];
          return (
            <button
              key={slot.rotulo}
              onClick={() => {
                setAberto(aberto === idx ? null : idx);
                setRecusa(null);
              }}
              className="w-[5.5rem] flex flex-col items-center gap-1"
            >
              <span
                className={`h-11 w-11 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  escolhido
                    ? "bg-foreground/15 ring-2 ring-foreground/50 text-foreground"
                    : "border-2 border-dashed border-foreground/40 text-foreground/60"
                }`}
              >
                {escolhido ? iniciaisCurtas(escolhido.nome) : slot.rotulo}
              </span>
              <span className="text-[10px] text-foreground/80 leading-tight truncate w-full text-center">
                {escolhido?.nome ?? "Escalar"}
              </span>
            </button>
          );
        })}
      </div>

      {aberto !== null && (
        <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {DEMO[aberto].candidatos.map((c) => (
            <li key={c.nome}>
              <button
                onClick={() => tentar(aberto, c)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-foreground truncate">{c.nome}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {c.clube} · {c.pos}
                  </span>
                </span>
                {c.pos === DEMO[aberto].rotulo ? (
                  <Check size={13} className="text-sim shrink-0" />
                ) : (
                  <X size={13} className="text-nao shrink-0" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {recusa && <p className="text-xs text-nao">{recusa}</p>}
      {completo && !recusa && (
        <p className="text-xs text-sim">
          É isso. No time de verdade são 11 vagas assim, mais o banco.
        </p>
      )}
    </div>
  );
}

/** Passo 3 — de onde vem o ponto e por que ele importa. */
function PassoPontue() {
  const [n, setN] = useState(0);
  const revelados = LANCES.slice(0, n);
  const total = revelados.reduce((s, l) => s + l.pts, 0);
  const fim = n >= LANCES.length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Ninguém aposta em placar: seu atleta pontua pelo que ele fizer de verdade na
        competição, lance a lance. Abaixo, <strong className="text-foreground">uma rodada</strong>.
      </p>

      <div className="rounded-xl bg-input/60 border border-border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">Pedro · Flamengo</span>
          <span className="text-sm font-black text-foreground tabular-nums">{total} pts</span>
        </div>

        <ul className="space-y-1 min-h-[5rem]">
          {revelados.map((l) => (
            <li key={l.texto} className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{l.texto}</span>
              <span className={l.pts >= 0 ? "text-sim" : "text-nao"}>
                {l.pts >= 0 ? "+" : ""}
                {l.pts}
              </span>
            </li>
          ))}
          {n === 0 && (
            <li className="text-[11px] text-muted-foreground/70">
              Ainda não entrou em campo.
            </li>
          )}
        </ul>

        <button
          onClick={() => setN(fim ? 0 : n + 1)}
          className="w-full py-1.5 rounded-lg bg-input border border-border text-[11px] font-semibold text-foreground hover:bg-foreground/5 transition-colors inline-flex items-center justify-center gap-1.5"
        >
          <Play size={11} /> {fim ? "Rodar de novo" : n === 0 ? "Simular a rodada" : "Próximo lance"}
        </button>
      </div>

      {/* O ponto que o tutorial existia sem dizer: nas ligas o time é um só e
          acumula o mês. Quem lê "17 pts" e imagina que é isso o mês inteiro
          escala errado — e quem imagina o contrário espera 4× mais Z$. */}
      {fim && (
        <p className="text-xs text-foreground">
          Isso foi <strong>uma rodada</strong>. Nas ligas — Futebol Brasileiro, Basquete, Futebol Americano, Valorant —
          o time é um só para o mês e joga todas as rodadas: a pontuação do atleta é a soma
          delas.
        </p>
      )}

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Coins size={13} className="text-primary shrink-0 mt-0.5" />
        <span>
          Cada titular pontua assim, e a soma dos titulares é a pontuação do seu time.{" "}
          <strong className="text-foreground">1 ponto = 1 Z$</strong> na sua carteira quando a
          Convocação é apurada. Reserva só entra se um titular não competir.
        </span>
      </p>
    </div>
  );
}

function iniciaisCurtas(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}
