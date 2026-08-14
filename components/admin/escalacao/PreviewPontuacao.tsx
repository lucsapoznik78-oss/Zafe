"use client";

import type { ResultadoMes } from "@/lib/escalacao/scoring";

/**
 * O breakdown itemizado que o Art. 34 exige — mostrado ANTES de gravar.
 *
 * É a trava mais barata contra erro de digitação num modo que emite moeda: o
 * apurador vê "Golpes significativos 96 × 0,3 → +28,8" e percebe o dígito a
 * mais antes que ele vire Z$ no bolso de alguém.
 */
export default function PreviewPontuacao({ resultado }: { resultado: ResultadoMes }) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-3 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Total no mês</span>
        <span className="text-lg font-bold text-foreground tabular-nums">
          {resultado.total.toFixed(1)}
        </span>
      </div>

      {resultado.porEvento.map((ev) => (
        <div key={ev.eventoKey} className="space-y-1">
          <div className="flex items-baseline justify-between border-b border-border pb-1">
            <span className="text-[11px] font-semibold text-foreground">{ev.eventoKey}</span>
            <span className="text-[11px] text-foreground tabular-nums">
              {ev.total.toFixed(1)}
              {ev.clampado && (
                <span className="ml-1 text-nao">
                  ({ev.clampado} · bruto {ev.bruto.toFixed(1)})
                </span>
              )}
            </span>
          </div>
          {ev.linhas.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nenhuma regra pontuou.</p>
          ) : (
            <ul className="space-y-0.5">
              {ev.linhas.map((l, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground">
                    {l.ocorrencia !== undefined && (
                      <span className="text-foreground/60">#{l.ocorrencia} </span>
                    )}
                    {l.rotulo}
                    <span className="text-foreground/40"> · {l.conta}</span>
                  </span>
                  <span
                    className={`tabular-nums shrink-0 ${l.pontos < 0 ? "text-nao" : "text-sim"}`}
                  >
                    {l.pontos > 0 ? "+" : ""}
                    {l.pontos.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
