"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import type { Conferencia } from "@/lib/escalacao/conferencia";
import type { AtletaProposto, PesquisaResultado } from "@/lib/escalacao/pesquisa-ia";

export interface EsporteOpcao {
  key: string;
  nome: string;
  evento_key: string | null;
  /** Atletas no pool e quantos já têm nota — é o "onde eu parei". */
  total: number;
  comNota: number;
}

export interface CardOpcao {
  id: string;
  titulo: string;
  status: string;
  esportes: EsporteOpcao[];
}

/**
 * Fluxo em dois cliques, de propósito: pesquisar mostra, gravar escreve. O
 * admin vê o que a IA achou e quantos pontos aquilo virou ANTES de qualquer
 * coisa tocar o banco — e a soma por usuário só aparece depois de gravar,
 * porque antes disso ela não existe.
 *
 * Aceita vários cards porque é o painel de entrada da Escalação: dar nota a
 * atleta é a tarefa mais frequente do módulo e não devia exigir navegar até o
 * card antes.
 */
export default function PesquisaIA({ cards }: { cards: CardOpcao[] }) {
  const router = useRouter();
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [esporteEscolhido, setEsporte] = useState<string | null>(null);
  const [pesquisando, setPesquisando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<PesquisaResultado | null>(null);
  const [aprovados, setAprovados] = useState<Set<string>>(new Set());
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);

  // Derivado, não estado: quando o card muda, o esporte escolhido pode nem
  // existir no novo. Guardar isso em `useState` exigiria um efeito de sincronia
  // que erraria no primeiro render.
  const card = cards.find((c) => c.id === cardId) ?? cards[0];
  const esportes = card?.esportes ?? [];
  const esporte =
    esportes.find((e) => e.key === esporteEscolhido)?.key ?? esportes[0]?.key ?? "";

  function trocarCard(id: string) {
    setCardId(id);
    setEsporte(null);
    setResultado(null);
    setConferencia(null);
    setErro(null);
  }

  async function pesquisar() {
    setErro(null);
    setConferencia(null);
    setResultado(null);
    setPesquisando(true);
    try {
      const res = await fetch(`/api/admin/escalacao/${cardId}/pesquisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "preview", esporte_key: esporte }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Falha na pesquisa");
        return;
      }
      setResultado(json as PesquisaResultado);
      // Pré-aprova só o que veio limpo. Quem tem erro ou confiança baixa entra
      // desmarcado — o default nunca deve ser gravar dado duvidoso.
      setAprovados(
        new Set(
          (json.atletas as AtletaProposto[])
            .filter((a) => !a.erro && a.confianca >= 70)
            .map((a) => a.card_atleta_id)
        )
      );
    } catch {
      setErro("Falha de rede");
    } finally {
      setPesquisando(false);
    }
  }

  async function gravar() {
    if (!resultado) return;
    setErro(null);
    setGravando(true);
    try {
      const propostas = resultado.atletas
        .filter((a) => aprovados.has(a.card_atleta_id))
        .map((a) => ({
          card_atleta_id: a.card_atleta_id,
          evento_key: a.evento_key,
          competiu: a.competiu,
          motivo_ausencia: a.motivo_ausencia,
          linhas: a.linhas,
        }));

      const res = await fetch(`/api/admin/escalacao/${cardId}/pesquisar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "gravar", propostas }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Falha ao gravar");
        return;
      }
      setConferencia(json.conferencia as Conferencia);
      router.refresh();
    } catch {
      setErro("Falha de rede");
    } finally {
      setGravando(false);
    }
  }

  function alternar(id: string) {
    setAprovados((antes) => {
      const novo = new Set(antes);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const inscritos = conferencia?.times.filter((t) => t.status !== "rascunho") ?? [];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Sparkles size={14} className="text-primary" />
          Apurar com IA
        </h3>
        <span className="text-[11px] text-muted-foreground">Claude + busca na web</span>
      </div>

      <p className="text-[11px] text-muted-foreground">
        A IA busca o desempenho real e preenche os stats de cada atleta. Quem converte em
        pontos é o ruleset congelado no card — a IA nunca decide pontuação. A nota sai por
        atleta, não por usuário: ela vale igual para todos os times que o escalaram.
      </p>

      {cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum card com pool importado. Crie o card e importe o pool antes.
        </p>
      ) : (
        <>
      {cards.length > 1 && (
        <select
          value={card?.id ?? ""}
          onChange={(e) => trocarCard(e.target.value)}
          disabled={pesquisando || gravando}
          className="w-full px-2.5 py-1.5 rounded-lg bg-input border border-border text-xs text-white"
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo} · {c.status}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2">
        <select
          value={esporte}
          onChange={(e) => setEsporte(e.target.value)}
          disabled={pesquisando || gravando}
          className="flex-1 px-2.5 py-1.5 rounded-lg bg-input border border-border text-xs text-white"
        >
          {esportes.map((e) => (
            <option key={e.key} value={e.key}>
              {e.nome} · {e.comNota}/{e.total} com nota
              {e.evento_key ? ` · ${e.evento_key}` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={pesquisar}
          disabled={pesquisando || gravando || !esporte}
          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
        >
          {pesquisando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {pesquisando ? "Pesquisando…" : "Pesquisar"}
        </button>
      </div>

      {erro && <p className="text-[11px] text-nao">{erro}</p>}

      {resultado && (
        <div className="space-y-2 pt-1">
          <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
            <span>
              {resultado.atletas.length} atletas · evento{" "}
              <span className="text-white">{resultado.evento_key}</span>
            </span>
            <span>{aprovados.size} selecionados</span>
          </div>

          <ul className="divide-y divide-border">
            {resultado.atletas.map((a) => (
              <li key={a.card_atleta_id} className="py-2 flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={aprovados.has(a.card_atleta_id)}
                  onChange={() => alternar(a.card_atleta_id)}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-white truncate">{a.nome}</span>
                    <span className="text-white tabular-nums shrink-0">
                      {a.competiu ? a.pontos.toFixed(1) : "não competiu"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {a.erro ? (
                      <span className="text-nao">{a.erro}</span>
                    ) : (
                      <>
                        confiança {a.confianca}%
                        {a.motivo_ausencia ? ` · ${a.motivo_ausencia}` : ""}
                        {a.fonte ? ` · ${a.fonte}` : ""}
                      </>
                    )}
                  </p>
                  {a.porEvento.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {a.porEvento
                        .flatMap((ev) => ev.linhas)
                        .map((l) => `${l.rotulo} ${l.pontos > 0 ? "+" : ""}${l.pontos}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={gravar}
            disabled={gravando || aprovados.size === 0}
            className="w-full px-3 py-2 rounded-lg bg-input border border-border text-xs font-semibold text-white hover:bg-white/5 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {gravando && <Loader2 size={12} className="animate-spin" />}
            {gravando
              ? "Gravando e recalculando…"
              : `Gravar ${aprovados.size} e recalcular`}
          </button>
        </div>
      )}

      {conferencia && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs font-semibold text-white">Soma por usuário</h4>
            <span
              className={`text-[11px] tabular-nums ${
                conferencia.totais.estoura_teto ? "text-nao font-bold" : "text-muted-foreground"
              }`}
            >
              {conferencia.totais.z_a_emitir} Z$ a emitir · teto{" "}
              {conferencia.card.teto_emissao_z} Z$
            </span>
          </div>
          {inscritos.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Ninguém inscrito ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {inscritos.map((t, i) => (
                <li
                  key={t.time_id}
                  className="py-1.5 flex items-baseline justify-between gap-2 text-xs"
                >
                  <span className="text-white truncate">
                    <span className="text-muted-foreground">{i + 1}º </span>
                    {t.nome || "(sem nome)"}
                    <span className="text-muted-foreground"> · @{t.username}</span>
                  </span>
                  <span className="text-white tabular-nums shrink-0">
                    {t.pontos_total === null ? "—" : t.pontos_total.toFixed(1)} pts ·{" "}
                    {t.z_a_emitir} Z$
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
