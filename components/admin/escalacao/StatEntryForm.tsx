"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

import type { Ruleset, StatDecl } from "@/lib/escalacao/rules";
import type { ResultadoMes } from "@/lib/escalacao/scoring";
import PreviewPontuacao from "./PreviewPontuacao";

interface Atleta {
  id: string;
  nome: string;
  esporte_key: string;
}

interface Props {
  cardId: string;
  atletas: Atleta[];
  rulesets: Record<string, Ruleset>;
  eventoPadrao: Record<string, string | null>;
}

type Valores = Record<string, string>;

/**
 * O formulário é GERADO a partir de `ruleset.stats` — não há uma linha de código
 * por esporte aqui. Boxe, F1, Champions e tênis chegam como INSERT em
 * `escalacao_regra` e este formulário já sabe desenhá-los.
 */
export default function StatEntryForm({ cardId, atletas, rulesets, eventoPadrao }: Props) {
  const router = useRouter();

  const [atletaId, setAtletaId] = useState(atletas[0]?.id ?? "");
  const atleta = atletas.find((a) => a.id === atletaId);
  const ruleset = atleta ? rulesets[atleta.esporte_key] : undefined;

  const [eventoKey, setEventoKey] = useState(
    atleta ? eventoPadrao[atleta.esporte_key] ?? "" : ""
  );
  const [competiu, setCompetiu] = useState<"" | "sim" | "nao">("");
  const [motivo, setMotivo] = useState("");
  const [geral, setGeral] = useState<Valores>({});
  const [ocorrencias, setOcorrencias] = useState<Valores[]>([{}]);

  const [ocupado, setOcupado] = useState<"preview" | "salvar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResultadoMes | null>(null);

  function trocarAtleta(id: string) {
    setAtletaId(id);
    const novo = atletas.find((a) => a.id === id);
    setEventoKey(novo ? eventoPadrao[novo.esporte_key] ?? "" : "");
    setGeral({});
    setOcorrencias([{}]);
    setPreview(null);
    setErro(null);
  }

  const declsGerais = (ruleset?.stats ?? []).filter((s) => !s.porOcorrencia);
  const declsOcorrencia = (ruleset?.stats ?? []).filter((s) => s.porOcorrencia);

  function montarLinhas() {
    const linhas: Array<{
      ordem: number;
      stat_key: string;
      valor_num?: number | null;
      valor_txt?: string | null;
    }> = [];

    const push = (ordem: number, decl: StatDecl, bruto: string | undefined) => {
      if (decl.tipo === "bool") {
        // Booleano sempre vai, inclusive `false`: o surf lê "não avançou de
        // NENHUMA bateria" como um limiar sobre a soma dos avanços, e a ausência
        // da linha não é a mesma coisa que um zero.
        linhas.push({ ordem, stat_key: decl.key, valor_num: bruto === "1" ? 1 : 0 });
        return;
      }
      const v = (bruto ?? "").trim();
      if (!v) return;
      if (decl.tipo === "num") {
        const n = Number(v.replace(",", "."));
        if (Number.isFinite(n)) linhas.push({ ordem, stat_key: decl.key, valor_num: n });
        return;
      }
      linhas.push({ ordem, stat_key: decl.key, valor_txt: v });
    };

    for (const decl of declsGerais) push(0, decl, geral[decl.key]);
    ocorrencias.forEach((oc, i) => {
      // Ocorrência em branco não vira linha — o apurador deixa a última vazia o
      // tempo todo enquanto digita.
      const preenchida = declsOcorrencia.some(
        (d) => d.tipo !== "bool" && (oc[d.key] ?? "").trim() !== ""
      );
      if (!preenchida) return;
      for (const decl of declsOcorrencia) push(i + 1, decl, oc[decl.key]);
    });

    return linhas;
  }

  async function enviar(modo: "preview" | "salvar") {
    setErro(null);
    setOcupado(modo);
    const res = await fetch(`/api/admin/escalacao/${cardId}/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        card_atleta_id: atletaId,
        evento_key: eventoKey,
        preview: modo === "preview",
        competiu: competiu === "" ? undefined : competiu === "sim",
        motivo_ausencia: competiu === "nao" ? motivo || null : null,
        linhas: montarLinhas(),
      }),
    });
    const json = await res.json();
    setOcupado(null);
    if (!res.ok) {
      setErro(json.error ?? "Falha ao lançar stats");
      return;
    }
    setPreview(json.resultado);
    if (modo === "salvar") router.refresh();
  }

  const campo = "w-full bg-input border border-border rounded-lg px-2 py-1.5 text-sm text-white";
  const rotulo = "text-xs text-muted-foreground";

  function campoStat(decl: StatDecl, valor: string | undefined, onChange: (v: string) => void) {
    if (decl.tipo === "bool") {
      return (
        <button
          type="button"
          onClick={() => onChange(valor === "1" ? "0" : "1")}
          className={`w-full py-1.5 rounded-lg text-xs border transition-colors ${
            valor === "1"
              ? "bg-sim/20 text-sim border-sim"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          {valor === "1" ? "sim" : "não"}
        </button>
      );
    }
    if (decl.tipo === "cat") {
      return (
        <select value={valor ?? ""} onChange={(e) => onChange(e.target.value)} className={campo}>
          <option value="">—</option>
          {(decl.opcoes ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value)}
        inputMode={decl.tipo === "num" ? "decimal" : "text"}
        placeholder={decl.tipo === "lista" ? "8.20;10.00" : ""}
        className={campo}
      />
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white">Lançar stats</h3>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className={rotulo}>Atleta</span>
          <select value={atletaId} onChange={(e) => trocarAtleta(e.target.value)} className={campo}>
            {atletas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} ({a.esporte_key})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={rotulo}>Evento</span>
          <input
            value={eventoKey}
            onChange={(e) => setEventoKey(e.target.value)}
            placeholder="ufc-331"
            className={campo}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className={rotulo}>Competiu?</span>
          <select
            value={competiu}
            onChange={(e) => setCompetiu(e.target.value as "" | "sim" | "nao")}
            className={campo}
          >
            <option value="">não alterar</option>
            <option value="sim">sim</option>
            <option value="nao">não (aciona reserva)</option>
          </select>
        </label>
        {competiu === "nao" && (
          <label className="space-y-1">
            <span className={rotulo}>Motivo</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo} />
          </label>
        )}
      </div>

      {!ruleset ? (
        <p className="text-xs text-nao">Ruleset do esporte não carregado.</p>
      ) : (
        <>
          {declsGerais.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {declsGerais.map((decl) => (
                <label key={decl.key} className="space-y-1">
                  <span className={rotulo}>{decl.rotulo}</span>
                  {campoStat(decl, geral[decl.key], (v) =>
                    setGeral((atual) => ({ ...atual, [decl.key]: v }))
                  )}
                  {decl.ajuda && (
                    <span className="text-[10px] text-muted-foreground block">{decl.ajuda}</span>
                  )}
                </label>
              ))}
            </div>
          )}

          {declsOcorrencia.length > 0 && (
            <div className="space-y-2">
              <span className={rotulo}>Ocorrências (bateria, luta, corrida)</span>
              {ocorrencias.map((oc, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white">#{i + 1}</span>
                    {ocorrencias.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setOcorrencias((a) => a.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-nao"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {declsOcorrencia.map((decl) => (
                      <label key={decl.key} className="space-y-1">
                        <span className={rotulo}>{decl.rotulo}</span>
                        {campoStat(decl, oc[decl.key], (v) =>
                          setOcorrencias((atual) =>
                            atual.map((o, j) => (j === i ? { ...o, [decl.key]: v } : o))
                          )
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOcorrencias((a) => [...a, {}])}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white"
              >
                <Plus size={12} /> adicionar ocorrência
              </button>
            </div>
          )}
        </>
      )}

      {erro && <p className="text-xs text-nao">{erro}</p>}
      {preview && <PreviewPontuacao resultado={preview} />}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => enviar("preview")}
          disabled={!!ocupado || !eventoKey || !atletaId}
          className="py-2 bg-muted text-white font-bold text-sm rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors"
        >
          {ocupado === "preview" ? (
            <Loader2 size={14} className="animate-spin mx-auto" />
          ) : (
            "Pré-visualizar"
          )}
        </button>
        <button
          onClick={() => enviar("salvar")}
          disabled={!!ocupado || !eventoKey || !atletaId}
          className="py-2 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {ocupado === "salvar" ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Gravar"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Gravar SUBSTITUI todas as linhas deste atleta neste evento — relançar corrige, nunca
        acumula. Os pontos só entram no ranking depois de “Recalcular”.
      </p>
    </div>
  );
}
