"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star, X } from "lucide-react";

import type { AtletaDoPool, CardPublico, MeuTime } from "@/lib/escalacao/publico";

interface Props {
  card: CardPublico;
  pool: AtletaDoPool[];
  nomeDoEsporte: Record<string, string>;
  time: MeuTime | null;
}

export default function MontarTime({ card, pool, nomeDoEsporte, time }: Props) {
  const router = useRouter();
  const porId = useMemo(() => new Map(pool.map((a) => [a.card_atleta_id, a])), [pool]);

  const [titulares, setTitulares] = useState<string[]>(
    () => (time?.slots ?? []).filter((s) => s.papel === "titular").map((s) => s.card_atleta_id)
  );
  const [reservas, setReservas] = useState<string[]>(
    () => (time?.slots ?? []).filter((s) => s.papel === "reserva").map((s) => s.card_atleta_id)
  );
  const [nome, setNome] = useState(time?.nome ?? "");
  const [esporteAberto, setEsporteAberto] = useState<string>(pool[0]?.esporte_key ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"salvar" | "inscrever" | null>(null);

  const inscrito = time?.status && time.status !== "rascunho";
  const escalados = new Set([...titulares, ...reservas]);

  // Art. 10 § único: o teto conta só os titulares, salvo se o card disser o
  // contrário. Mesma conta do trigger T1 — aqui é só para não deixar o usuário
  // montar algo que o banco vai recusar.
  function usadosNoEsporte(esporte: string): number {
    const conta = card.teto_conta_reservas ? [...titulares, ...reservas] : titulares;
    return conta.filter((id) => porId.get(id)?.esporte_key === esporte).length;
  }

  function alternar(id: string, papel: "titular" | "reserva") {
    setErro(null);
    setAviso(null);
    const lista = papel === "titular" ? titulares : reservas;
    const setLista = papel === "titular" ? setTitulares : setReservas;
    const limite = papel === "titular" ? card.n_titulares : card.n_reservas;

    if (lista.includes(id)) {
      setLista(lista.filter((x) => x !== id));
      return;
    }
    if (escalados.has(id)) {
      setErro("Esse atleta já está no seu time.");
      return;
    }
    if (lista.length >= limite) {
      setErro(`Você já tem ${limite} ${papel === "titular" ? "titulares" : "reservas"}.`);
      return;
    }
    const esporte = porId.get(id)?.esporte_key ?? "";
    const contaNoTeto = papel === "titular" || card.teto_conta_reservas;
    if (contaNoTeto && usadosNoEsporte(esporte) >= card.teto_por_esporte) {
      setErro(
        `Máximo de ${card.teto_por_esporte} atletas de ${nomeDoEsporte[esporte] ?? esporte}.`
      );
      return;
    }
    setLista([...lista, id]);
  }

  async function salvar(): Promise<boolean> {
    setEnviando("salvar");
    setErro(null);
    setAviso(null);
    const res = await fetch("/api/escalacao/time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const completo = titulares.length === card.n_titulares && reservas.length === card.n_reservas;
  const esportes = Array.from(new Set(pool.map((a) => a.esporte_key)));
  const doEsporte = pool.filter((a) => a.esporte_key === esporteAberto);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Seu time</h2>
          <span
            className={`text-[11px] ${completo ? "text-sim" : "text-muted-foreground"}`}
          >
            {titulares.length}/{card.n_titulares} titulares ·{" "}
            {reservas.length}/{card.n_reservas} reservas
          </span>
        </div>

        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={40}
          placeholder="Nome do time (opcional)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-white"
        />

        <Escalados
          rotulo="Titulares"
          ids={titulares}
          porId={porId}
          nomeDoEsporte={nomeDoEsporte}
          onRemover={(id) => alternar(id, "titular")}
        />
        <Escalados
          rotulo="Reservas (entram na ordem, se um titular não competir)"
          ids={reservas}
          porId={porId}
          nomeDoEsporte={nomeDoEsporte}
          onRemover={(id) => alternar(id, "reserva")}
        />

        {erro && <p className="text-xs text-nao">{erro}</p>}
        {aviso && <p className="text-xs text-sim">{aviso}</p>}

        <div className="flex gap-2">
          <button
            onClick={salvar}
            disabled={enviando !== null}
            className="flex-1 py-2 bg-input border border-border text-white font-bold text-sm rounded-lg hover:bg-input/70 disabled:opacity-50 transition-colors"
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
              className="flex-1 py-2 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Atletas disponíveis</h2>
        <div className="flex flex-wrap gap-1.5">
          {esportes.map((e) => (
            <button
              key={e}
              onClick={() => setEsporteAberto(e)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                e === esporteAberto
                  ? "bg-primary text-white"
                  : "bg-input text-muted-foreground hover:text-white"
              }`}
            >
              {nomeDoEsporte[e] ?? e} · {usadosNoEsporte(e)}/{card.teto_por_esporte}
            </button>
          ))}
        </div>

        <ul className="divide-y divide-border">
          {doEsporte.map((a) => {
            const escalado = escalados.has(a.card_atleta_id);
            return (
              <li key={a.card_atleta_id} className="flex items-center gap-2 py-1.5">
                <span
                  className={`flex-1 text-sm ${escalado ? "text-muted-foreground" : "text-white"}`}
                >
                  {a.nome}
                  {a.genero === "f" && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">fem</span>
                  )}
                </span>
                <button
                  onClick={() => alternar(a.card_atleta_id, "titular")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    titulares.includes(a.card_atleta_id)
                      ? "bg-primary text-white"
                      : "bg-input text-muted-foreground hover:text-white"
                  }`}
                >
                  Titular
                </button>
                <button
                  onClick={() => alternar(a.card_atleta_id, "reserva")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    reservas.includes(a.card_atleta_id)
                      ? "bg-primary text-white"
                      : "bg-input text-muted-foreground hover:text-white"
                  }`}
                >
                  Reserva
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Escalados({
  rotulo,
  ids,
  porId,
  nomeDoEsporte,
  onRemover,
}: {
  rotulo: string;
  ids: string[];
  porId: Map<string, AtletaDoPool>;
  nomeDoEsporte: Record<string, string>;
  onRemover: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{rotulo}</p>
      {ids.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">Nenhum ainda.</p>
      ) : (
        <ul className="space-y-1">
          {ids.map((id, i) => {
            const a = porId.get(id);
            return (
              <li
                key={id}
                className="flex items-center gap-2 bg-input rounded-lg px-2.5 py-1.5"
              >
                <Star size={11} className="text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <span className="flex-1 text-sm text-white truncate">{a?.nome ?? "—"}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {nomeDoEsporte[a?.esporte_key ?? ""] ?? a?.esporte_key}
                </span>
                <button
                  onClick={() => onRemover(id)}
                  aria-label={`Tirar ${a?.nome ?? "atleta"} do time`}
                  className="text-muted-foreground hover:text-nao transition-colors"
                >
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
