"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search, X } from "lucide-react";

import FotoAtleta from "@/components/escalacao/FotoAtleta";
import { corDoEsporte } from "@/lib/escalacao/cores";
import type {
  AtletaDoPool,
  CardPublico,
  MeuTime,
  SlotFormacao,
} from "@/lib/escalacao/publico";

interface Props {
  card: CardPublico;
  pool: AtletaDoPool[];
  nomeDoEsporte: Record<string, string>;
  time: MeuTime | null;
  /** Convocação fechada: o campo vira só exibição. */
  somenteLeitura?: boolean;
}

/**
 * Distribui os titulares em linhas de no máximo 4, com a linha mais larga no
 * meio — é o que faz o campo parecer uma formação e não uma grade.
 * 10 → 3-4-3 · 11 → 4-4-3 · 12 → 4-4-4.
 *
 * Só vale para o mix, onde não existe formação: o time é um apanhado de atletas
 * de esportes diferentes e a disposição é puramente visual. No fixo o desenho
 * vem de `card.formacao` e cada slot exige uma posição.
 */
function linhasDoCampo(n: number): number[] {
  const q = Math.max(1, Math.ceil(n / 4));
  const linhas = Array.from({ length: q }, () => Math.floor(n / q));
  let resto = n % q;
  const meio = (q - 1) / 2;
  const ordem = linhas
    .map((_, i) => i)
    .sort((a, b) => Math.abs(a - meio) - Math.abs(b - meio));
  for (const i of ordem) {
    if (resto <= 0) break;
    linhas[i] += 1;
    resto -= 1;
  }
  return linhas;
}

/** `pos: null` é slot livre (o FLEX da NFL, o quinto do Valorant). */
function serveNoSlot(slot: SlotFormacao | undefined, a: AtletaDoPool): boolean {
  if (!slot?.pos) return true;
  return a.posicao != null && slot.pos.includes(a.posicao);
}

type Alvo = { papel: "titular" | "reserva"; idx: number };

export default function MontarTime({
  card,
  pool,
  nomeDoEsporte,
  time,
  somenteLeitura = false,
}: Props) {
  const router = useRouter();
  const porId = useMemo(
    () => new Map(pool.map((a) => [a.card_atleta_id, a])),
    [pool]
  );

  // A formação só entra em cena se o desenho bater com o tamanho do time. O
  // banco valida a mesma coisa (081); aqui é só para um card mal semeado em
  // rascunho degradar para o campo genérico em vez de quebrar a página.
  const formacao = useMemo(() => {
    const f = card.formacao;
    if (!f) return null;
    const slots = f.linhas.flat();
    return slots.length === card.n_titulares ? { ...f, slots } : null;
  }, [card.formacao, card.n_titulares]);

  const slotTitular = (idx: number) => formacao?.slots[idx];
  const slotReserva = (idx: number) => formacao?.banco?.[idx];

  // Slots de tamanho fixo com buracos: é isso que torna um slot endereçável
  // ("trocar o goleiro") em vez de uma lista que só cresce no fim. E é o que
  // permite mandar a escalação incompleta sem deslocar as posições.
  const [titulares, setTitulares] = useState<(string | null)[]>(() => {
    const v = Array<string | null>(card.n_titulares).fill(null);
    for (const s of time?.slots ?? []) {
      if (s.papel === "titular" && s.ordem <= card.n_titulares) v[s.ordem - 1] = s.card_atleta_id;
    }
    return v;
  });
  const [reservas, setReservas] = useState<(string | null)[]>(() => {
    const v = Array<string | null>(card.n_reservas).fill(null);
    for (const s of time?.slots ?? []) {
      if (s.papel === "reserva" && s.ordem <= card.n_reservas) v[s.ordem - 1] = s.card_atleta_id;
    }
    return v;
  });

  const [nome, setNome] = useState(time?.nome ?? "");
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"salvar" | "inscrever" | null>(null);

  const inscrito = !!time?.status && time.status !== "rascunho";
  const escalados = useMemo(
    () => new Set([...titulares, ...reservas].filter(Boolean) as string[]),
    [titulares, reservas]
  );

  /**
   * Os atletas que contam para os tetos, com o slot que está sendo trocado já
   * esvaziado — senão o próprio ocupante contaria contra ele mesmo.
   * Mesma conta do trigger T1 (Art. 10 § único): o teto olha só os titulares,
   * salvo se o card disser o contrário.
   */
  function considerados(ignorar?: Alvo): Array<string | null> {
    const lista: Array<string | null> = card.teto_conta_reservas
      ? [...titulares, ...reservas]
      : [...titulares];
    if (ignorar && (ignorar.papel === "titular" || card.teto_conta_reservas)) {
      const base = ignorar.papel === "titular" ? 0 : titulares.length;
      lista[base + ignorar.idx] = null;
    }
    return lista;
  }

  function usadosNoEsporte(esporte: string, ignorar?: Alvo): number {
    return considerados(ignorar).filter(
      (id) => id && porId.get(id)?.esporte_key === esporte
    ).length;
  }

  function usadosNoClube(clube: string, ignorar?: Alvo): number {
    return considerados(ignorar).filter((id) => id && porId.get(id)?.clube === clube)
      .length;
  }

  function definir(alvoSlot: Alvo, id: string | null) {
    const setLista = alvoSlot.papel === "titular" ? setTitulares : setReservas;
    setLista((atual) => {
      const proximo = [...atual];
      proximo[alvoSlot.idx] = id;
      return proximo;
    });
    setErro(null);
    setAviso(null);
  }

  async function salvar(): Promise<boolean> {
    setEnviando("salvar");
    setErro(null);
    setAviso(null);
    const res = await fetch("/api/escalacao/time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Com buracos, de propósito: o índice do array É o slot da formação.
      body: JSON.stringify({ card_id: card.id, nome, titulares, reservas }),
    });
    const json = await res.json();
    setEnviando(null);
    if (!res.ok) {
      setErro(json.error ?? "Não foi possível salvar");
      return false;
    }
    router.refresh();
    return true;
  }

  async function inscrever() {
    if (!(await salvar())) return;
    setEnviando("inscrever");
    setErro(null);
    const res = await fetch("/api/escalacao/inscrever", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: card.id }),
    });
    const json = await res.json();
    setEnviando(null);
    if (!res.ok) {
      setErro(json.error ?? "Não foi possível inscrever");
      return;
    }
    setAviso(`Inscrito! ${json.entrada} Z$ debitados.`);
    router.refresh();
  }

  const preenchidos = escalados.size;
  const total = card.n_titulares + card.n_reservas;
  const completo = preenchidos === total;

  // Índice do primeiro slot de cada linha, para fatiar `titulares` sem contador.
  const tamanhos = formacao
    ? formacao.linhas.map((l) => l.length)
    : linhasDoCampo(card.n_titulares);
  let corrido = 0;
  const faixas = tamanhos.map((qtd) => {
    const inicio = corrido;
    corrido += qtd;
    return { inicio, qtd };
  });

  const emLista = formacao?.layout === "lista";
  const Palco = formacao?.layout === "quadra" ? Quadra : emLista ? Lista : Campo;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          {somenteLeitura ? (
            <h2 className="text-sm font-semibold text-white truncate">
              {nome || "Seu time"}
            </h2>
          ) : (
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={40}
              placeholder="Nome do time"
              aria-label="Nome do time"
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-white placeholder:text-muted-foreground/70 focus:outline-none"
            />
          )}
          <span
            className={`text-[11px] font-semibold shrink-0 ${
              completo ? "text-sim" : "text-muted-foreground"
            }`}
          >
            {preenchidos}/{total}
          </span>
        </div>

        <Palco>
          {faixas.map(({ inicio, qtd }, li) => (
            <div
              key={li}
              className={
                emLista ? "space-y-2" : "flex justify-center gap-2 sm:gap-4"
              }
            >
              {Array.from({ length: qtd }, (_, k) => inicio + k).map((idx) => (
                <Slot
                  key={idx}
                  atleta={titulares[idx] ? porId.get(titulares[idx]!) : undefined}
                  nomeDoEsporte={nomeDoEsporte}
                  rotulo={slotTitular(idx)?.rotulo}
                  deitado={emLista}
                  somenteLeitura={somenteLeitura}
                  onAbrir={() => setAlvo({ papel: "titular", idx })}
                  onLimpar={() => definir({ papel: "titular", idx }, null)}
                />
              ))}
            </div>
          ))}
        </Palco>

        {card.n_reservas > 0 && (
          <div className="px-4 py-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground mb-2">
              Banco — entram na ordem, se um titular não competir
            </p>
            <div className="flex gap-2 sm:gap-4">
              {reservas.map((id, idx) => (
                <Slot
                  key={idx}
                  atleta={id ? porId.get(id) : undefined}
                  nomeDoEsporte={nomeDoEsporte}
                  rotulo={slotReserva(idx)?.rotulo}
                  vazio={`${idx + 1}ª reserva`}
                  somenteLeitura={somenteLeitura}
                  onAbrir={() => setAlvo({ papel: "reserva", idx })}
                  onLimpar={() => definir({ papel: "reserva", idx }, null)}
                />
              ))}
            </div>
          </div>
        )}

        {formacao && (
          <p className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
            {formacao.resumo}
          </p>
        )}
      </div>

      {!somenteLeitura && (
        <>
          {/* Teto por esporte é regra de concentração e só existe no mix — num
              card de fixo o esporte é um só (081). */}
          {card.modo === "mix" && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set(pool.map((a) => a.esporte_key))).map((e) => {
                const usados = usadosNoEsporte(e);
                return (
                  <span
                    key={e}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium bg-gradient-to-b ring-1 ${corDoEsporte(
                      e
                    )}`}
                  >
                    {nomeDoEsporte[e] ?? e} {usados}/{card.teto_por_esporte}
                  </span>
                );
              })}
            </div>
          )}

          {erro && <p className="text-xs text-nao">{erro}</p>}
          {aviso && <p className="text-xs text-sim">{aviso}</p>}

          <div className="flex gap-2">
            <button
              onClick={salvar}
              disabled={enviando !== null}
              className="flex-1 py-2.5 bg-input border border-border text-white font-bold text-sm rounded-xl hover:bg-input/70 disabled:opacity-50 transition-colors"
            >
              {enviando === "salvar" ? (
                <Loader2 size={14} className="animate-spin mx-auto" />
              ) : (
                "Salvar"
              )}
            </button>
            {!inscrito && (
              <button
                onClick={inscrever}
                disabled={enviando !== null || !completo}
                className="flex-1 py-2.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {enviando === "inscrever" ? (
                  <Loader2 size={14} className="animate-spin mx-auto" />
                ) : (
                  `Inscrever · ${card.entrada_z} Z$`
                )}
              </button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {inscrito
              ? "Você já está inscrito. Dá para trocar de atleta até o fechamento."
              : `A entrada de ${card.entrada_z} Z$ é debitada na inscrição. Depois disso você ainda pode trocar de atleta até o fechamento.`}
          </p>
        </>
      )}

      {alvo && (
        <Seletor
          alvo={alvo}
          card={card}
          pool={pool}
          slot={alvo.papel === "titular" ? slotTitular(alvo.idx) : slotReserva(alvo.idx)}
          nomeDoEsporte={nomeDoEsporte}
          escalados={escalados}
          atualId={(alvo.papel === "titular" ? titulares : reservas)[alvo.idx]}
          usadosNoEsporte={(e) => usadosNoEsporte(e, alvo)}
          usadosNoClube={(c) => usadosNoClube(c, alvo)}
          onEscolher={(id) => {
            definir(alvo, id);
            setAlvo(null);
          }}
          onFechar={() => setAlvo(null)}
        />
      )}
    </div>
  );
}

/** O gramado. Linhas de campo em CSS puro — nenhuma imagem para carregar. */
function Campo({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative bg-gradient-to-b from-emerald-800 to-emerald-950 px-3 py-6">
      {/* faixas do corte da grama */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07] bg-[repeating-linear-gradient(180deg,#fff_0_28px,transparent_28px_56px)]"
      />
      {/* marcação: linha de fundo, meio-campo e círculo central */}
      <div aria-hidden="true" className="absolute inset-3 rounded-lg border border-white/20" />
      <div aria-hidden="true" className="absolute left-3 right-3 top-1/2 h-px bg-white/20" />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20"
      />
      <div className="relative space-y-5">{children}</div>
    </div>
  );
}

/** A quadra da NBA: taco claro, garrafão e linha de três no lugar do gramado. */
function Quadra({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative bg-gradient-to-b from-amber-700 to-amber-950 px-3 py-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(90deg,#fff_0_2px,transparent_2px_18px)]"
      />
      <div aria-hidden="true" className="absolute inset-3 rounded-lg border border-white/25" />
      {/* garrafão colado na linha de fundo (topo, onde fica o pivô) */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-3 h-24 w-28 -translate-x-1/2 border-x border-b border-white/25"
      />
      {/* arco de três pontos */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-3 h-44 w-72 -translate-x-1/2 rounded-b-full border-x border-b border-white/25"
      />
      <div className="relative space-y-5">{children}</div>
    </div>
  );
}

/** Valorant não é um jogo espacial: as cinco funções viram uma lista. */
function Lista({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-b from-slate-800 to-slate-950 px-3 py-4">
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Slot({
  atleta,
  nomeDoEsporte,
  rotulo,
  vazio,
  deitado = false,
  somenteLeitura,
  onAbrir,
  onLimpar,
}: {
  atleta?: AtletaDoPool;
  nomeDoEsporte: Record<string, string>;
  /** Posição exigida pela formação — ausente no mix. */
  rotulo?: string;
  /** Texto do slot vazio quando não há rótulo de posição. */
  vazio?: string;
  /** Linha larga em vez de coluna estreita (layout de lista). */
  deitado?: boolean;
  somenteLeitura: boolean;
  onAbrir: () => void;
  onLimpar: () => void;
}) {
  const legenda = rotulo ?? vazio ?? "Escalar";

  if (deitado) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-black/30 border border-white/10 px-3 py-2">
        <span className="w-24 shrink-0 text-[10px] font-bold tracking-wide text-white/70 uppercase">
          {legenda}
        </span>
        {atleta ? (
          <>
            <FotoAtleta
              nome={atleta.nome}
              esporte={atleta.esporte_key}
              fotoUrl={atleta.foto_url}
              tamanho="sm"
            />
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold text-white truncate">
                {atleta.nome}
              </span>
              <span className="block text-[10px] text-white/60 truncate">
                {atleta.clube ?? nomeDoEsporte[atleta.esporte_key] ?? atleta.esporte_key}
              </span>
            </span>
            <button
              onClick={somenteLeitura ? undefined : onAbrir}
              disabled={somenteLeitura}
              className="text-[10px] text-white/60 hover:text-white disabled:opacity-40 transition-colors"
            >
              trocar
            </button>
            {!somenteLeitura && (
              <button
                onClick={onLimpar}
                aria-label={`Tirar ${atleta.nome} do time`}
                className="text-white/50 hover:text-nao transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={somenteLeitura ? undefined : onAbrir}
            disabled={somenteLeitura}
            aria-label={`Escolher ${legenda}`}
            className="flex-1 flex items-center gap-2 text-left text-white/50 hover:text-white disabled:opacity-40 transition-colors"
          >
            <span className="h-9 w-9 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
              <Plus size={14} />
            </span>
            <span className="text-xs">Escalar</span>
          </button>
        )}
      </div>
    );
  }

  if (!atleta) {
    return (
      <button
        onClick={somenteLeitura ? undefined : onAbrir}
        disabled={somenteLeitura}
        aria-label={`Escolher ${legenda}`}
        className="w-[70px] sm:w-[84px] flex flex-col items-center gap-1 group disabled:opacity-50"
      >
        <span className="h-12 w-12 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center text-white/50 group-hover:border-white/80 group-hover:text-white transition-colors">
          <Plus size={16} />
        </span>
        <span className="text-[10px] font-semibold text-white/60 leading-tight">
          {legenda}
        </span>
      </button>
    );
  }

  return (
    <div className="w-[70px] sm:w-[84px] flex flex-col items-center gap-1">
      <button
        onClick={somenteLeitura ? undefined : onAbrir}
        disabled={somenteLeitura}
        aria-label={`Trocar ${atleta.nome}`}
        className="relative"
      >
        <FotoAtleta
          nome={atleta.nome}
          esporte={atleta.esporte_key}
          fotoUrl={atleta.foto_url}
        />
        {rotulo && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-black/80 border border-white/20 text-[8px] font-bold tracking-wide text-white/80">
            {rotulo}
          </span>
        )}
        {!somenteLeitura && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Tirar ${atleta.nome} do time`}
            onClick={(e) => {
              e.stopPropagation();
              onLimpar();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onLimpar();
              }
            }}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-white/70 hover:text-nao hover:border-nao/50 transition-colors"
          >
            <X size={11} />
          </span>
        )}
      </button>
      <span className="w-full text-center text-[10px] font-semibold text-white leading-tight truncate">
        {atleta.nome}
      </span>
      <span className="w-full text-center text-[9px] text-white/60 leading-tight truncate">
        {atleta.clube ?? nomeDoEsporte[atleta.esporte_key] ?? atleta.esporte_key}
      </span>
    </div>
  );
}

function Seletor({
  alvo,
  card,
  pool,
  slot,
  nomeDoEsporte,
  escalados,
  atualId,
  usadosNoEsporte,
  usadosNoClube,
  onEscolher,
  onFechar,
}: {
  alvo: Alvo;
  card: CardPublico;
  pool: AtletaDoPool[];
  slot?: SlotFormacao;
  nomeDoEsporte: Record<string, string>;
  escalados: Set<string>;
  atualId: string | null;
  usadosNoEsporte: (esporte: string) => number;
  usadosNoClube: (clube: string) => number;
  onEscolher: (id: string) => void;
  onFechar: () => void;
}) {
  const esportes = useMemo(
    () => Array.from(new Set(pool.map((a) => a.esporte_key))),
    [pool]
  );
  const [filtro, setFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  // A reserva só conta no teto quando o card diz que conta — mesma regra do T1.
  const contaNoTeto = alvo.papel === "titular" || card.teto_conta_reservas;
  const exigePosicao = !!slot?.pos;

  // Quem não serve na posição nem aparece: o slot é a pergunta, não um filtro.
  const lista = pool.filter((a) => {
    if (exigePosicao && !serveNoSlot(slot, a)) return false;
    if (filtro !== "todos" && a.esporte_key !== filtro) return false;
    if (!busca) return true;
    return a.nome.toLowerCase().includes(busca.toLowerCase().trim());
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escolher atleta"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col bg-card border border-border rounded-t-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-white">
            {slot?.rotulo
              ? `Escolher ${slot.rotulo}`
              : alvo.papel === "titular"
                ? "Escolher titular"
                : `Escolher ${alvo.idx + 1}ª reserva`}
          </h3>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 border-b border-border">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar atleta"
              aria-label="Buscar atleta"
              className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted-foreground"
            />
          </div>

          {exigePosicao && (
            <p className="text-[11px] text-muted-foreground">
              Só quem joga de{" "}
              <strong className="text-white">{slot!.pos!.join(" ou ")}</strong>.
            </p>
          )}

          {/* No fixo o pool é de um esporte só; as abas seriam uma aba. */}
          {card.modo === "mix" && (
            <div className="flex flex-wrap gap-1.5">
              <Aba ativa={filtro === "todos"} onClick={() => setFiltro("todos")}>
                Todos
              </Aba>
              {esportes.map((e) => (
                <Aba key={e} ativa={filtro === e} onClick={() => setFiltro(e)}>
                  {nomeDoEsporte[e] ?? e}
                  <span className="ml-1 opacity-60">
                    {usadosNoEsporte(e)}/{card.teto_por_esporte}
                  </span>
                </Aba>
              ))}
            </div>
          )}
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-border">
          {lista.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhum atleta encontrado.
            </li>
          )}
          {lista.map((a) => {
            const selecionado = a.card_atleta_id === atualId;
            const jaEscalado = escalados.has(a.card_atleta_id) && !selecionado;
            const noTetoEsporte =
              card.modo === "mix" &&
              contaNoTeto &&
              usadosNoEsporte(a.esporte_key) >= card.teto_por_esporte;
            const noTetoClube =
              card.teto_por_clube !== null &&
              contaNoTeto &&
              a.clube !== null &&
              usadosNoClube(a.clube) >= card.teto_por_clube;
            const noTeto = noTetoEsporte || noTetoClube;
            const bloqueado = jaEscalado || (noTeto && !selecionado);

            return (
              <li key={a.card_atleta_id}>
                <button
                  onClick={() => !bloqueado && onEscolher(a.card_atleta_id)}
                  disabled={bloqueado}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    bloqueado ? "opacity-40 cursor-not-allowed" : "hover:bg-white/5"
                  }`}
                >
                  <FotoAtleta
                    nome={a.nome}
                    esporte={a.esporte_key}
                    fotoUrl={a.foto_url}
                    tamanho="sm"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-white truncate">
                      {a.nome}
                      {a.genero === "f" && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">fem</span>
                      )}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {[a.clube, a.posicao, nomeDoEsporte[a.esporte_key] ?? a.esporte_key]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {selecionado && <Check size={15} className="text-sim shrink-0" />}
                  {jaEscalado && (
                    <span className="text-[10px] text-muted-foreground shrink-0">no time</span>
                  )}
                  {!jaEscalado && noTeto && !selecionado && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {noTetoClube ? "teto do clube" : "teto"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Aba({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
        ativa ? "bg-primary text-white" : "bg-input text-muted-foreground hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
