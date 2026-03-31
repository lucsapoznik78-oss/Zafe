"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Resolucao {
  id: string;
  mercado_id: string;
  resolvido_por: string;
  oracle_usado: string;
  numero_tentativa: number;
  resultado_final: string;
  check1_resultado: string | null;
  check1_fonte: string | null;
  check1_confianca: number | null;
  check2_resultado: string | null;
  check2_fonte: string | null;
  check2_confianca: number | null;
  check3_resultado: string | null;
  check3_fonte: string | null;
  check3_confianca: number | null;
  resolvido_em: string;
  topic?: { title: string };
}

const RESULTADO_COLOR: Record<string, string> = {
  SIM: "text-green-400",
  NAO: "text-red-400",
  INCERTO: "text-yellow-400",
  REEMBOLSO: "text-blue-400",
  SINALIZADO_REVISAO: "text-orange-400",
};

const ORACLE_LABEL: Record<string, string> = {
  api_fixa: "API Fixa",
  oracle_ai: "AI Triple-Check",
  reembolso: "Reembolso Auto",
  pendente: "Aguardando",
};

export default function OracleLog() {
  const [rows, setRows] = useState<Resolucao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("resolucoes")
      .select("*, topic:topics(title)")
      .order("resolvido_em", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-muted-foreground text-sm">Carregando...</p>;
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma resolução registrada ainda.</p>;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white line-clamp-1">
                {r.topic?.title ?? r.mercado_id}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(r.resolvido_em).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className={`text-sm font-bold ${RESULTADO_COLOR[r.resultado_final] ?? "text-white"}`}>
                {r.resultado_final}
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {ORACLE_LABEL[r.resolvido_por] ?? r.resolvido_por}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="bg-border/50 rounded px-2 py-0.5 text-muted-foreground">
              oracle: {r.oracle_usado}
            </span>
            <span className="bg-border/50 rounded px-2 py-0.5 text-muted-foreground">
              tentativa #{r.numero_tentativa}
            </span>
          </div>

          {/* Triple-check AI — só aparece se foi usado */}
          {r.check1_resultado && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
              {[
                { res: r.check1_resultado, fonte: r.check1_fonte, conf: r.check1_confianca, n: 1 },
                { res: r.check2_resultado, fonte: r.check2_fonte, conf: r.check2_confianca, n: 2 },
                { res: r.check3_resultado, fonte: r.check3_fonte, conf: r.check3_confianca, n: 3 },
              ].map((c) => (
                <div key={c.n} className="bg-background/50 rounded-lg p-2">
                  <p className="text-[9px] text-muted-foreground mb-1">Check {c.n}</p>
                  <p className={`text-xs font-bold ${RESULTADO_COLOR[c.res ?? ""] ?? "text-white"}`}>
                    {c.res ?? "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {c.conf != null ? `${c.conf}% conf.` : ""}
                  </p>
                  {c.fonte && (
                    <a
                      href={c.fonte}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-primary hover:underline break-all line-clamp-1"
                    >
                      {c.fonte}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
