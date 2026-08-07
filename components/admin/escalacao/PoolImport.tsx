"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  cardId: string;
  esportes: string[];
  bloqueado: boolean;
}

export default function PoolImport({ cardId, esportes, bloqueado }: Props) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [importados, setImportados] = useState<number | null>(null);
  const [erros, setErros] = useState<string[]>([]);

  async function importar() {
    setEnviando(true);
    setErros([]);
    setImportados(null);
    const res = await fetch(`/api/admin/escalacao/${cardId}/pool`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const json = await res.json();
    setEnviando(false);
    if (!res.ok) {
      setErros([json.error ?? "Falha ao importar"]);
      return;
    }
    setImportados(json.importados);
    setErros(json.erros ?? []);
    if (json.importados > 0) {
      setCsv("");
      router.refresh();
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">Pool do card</h3>
        <p className="text-[11px] text-muted-foreground">
          Uma linha por atleta:{" "}
          <code className="text-white">esporte,competicao_slug,nome,genero,referencia</code>. Esportes
          aceitos neste card: {esportes.join(", ") || "nenhum"}. Reimportar é idempotente.
        </p>
      </div>

      {bloqueado ? (
        <p className="text-xs text-muted-foreground">
          O prazo deste card já fechou — o pool está congelado (Art. 22).
        </p>
      ) : (
        <>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={8}
            placeholder={"ufc,ufc,Islam Makhachev,m,\nsurf,wsl-ct,Gabriel Medina,m,"}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-white"
          />
          <button
            onClick={importar}
            disabled={enviando || !csv.trim()}
            className="w-full py-2 bg-primary text-white font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {enviando ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Importar pool"}
          </button>
        </>
      )}

      {importados !== null && (
        <p className="text-xs text-sim">{importados} atleta(s) no pool.</p>
      )}
      {erros.length > 0 && (
        <ul className="space-y-0.5">
          {erros.map((e, i) => (
            <li key={i} className="text-[11px] text-nao">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
