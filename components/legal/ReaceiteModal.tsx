"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, ScrollText } from "lucide-react";
import type { PendenciaLegal } from "@/lib/legal-trail";

/**
 * Aceite expresso de uma nova versão dos documentos legais.
 *
 * É bloqueante de propósito: sem ESC, sem clique fora, sem X. Uso continuado da
 * plataforma NÃO vale como aceite (CDC art. 51, XIII), então a única saída é
 * clicar em "Aceitar e continuar" — ou fechar a aba, e aí o modal volta na
 * próxima visita, porque a pendência mora no banco, não no localStorage.
 *
 * Um documento por vez, com o resumo do que mudou e link para o texto integral,
 * para que o aceite seja informado e não um "ok" genérico em bloco.
 */
export default function ReaceiteModal({ pendentes }: { pendentes: PendenciaLegal[] }) {
  const router = useRouter();
  const [indice, setIndice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const atual = pendentes[indice];
  if (!atual) return null;

  async function aceitar() {
    setErro("");
    setLoading(true);
    const res = await fetch("/api/legal/aceite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: [atual.document] }),
    }).catch(() => null);

    // Sessão expirada não devolve 401 e sim um redirect do middleware para
    // /login, que responde 200 em HTML. Por isso o teste é a confirmação no
    // corpo, não `res.ok` — senão um aceite que nunca foi gravado passaria.
    const body = res?.ok ? await res.json().catch(() => null) : null;
    if (!Array.isArray(body?.aceitos)) {
      setErro("Não foi possível registrar seu aceite. Recarregue a página e tente de novo.");
      setLoading(false);
      return;
    }

    if (indice + 1 < pendentes.length) {
      setIndice(indice + 1);
      setLoading(false);
      return;
    }

    router.refresh();
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ScrollText size={16} className="text-primary shrink-0" />
            <DialogTitle>{atual.label} — nova versão</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Publicamos a versão <strong className="text-foreground">{atual.version}</strong>. Para
            continuar usando a Zafe, precisamos do seu aceite — nada muda para trás, e o texto
            anterior continua disponível no histórico.
          </p>
        </DialogHeader>

        {atual.changes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              O que mudou
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground leading-relaxed">
              {atual.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={atual.route}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-sm text-primary underline"
        >
          Ler o documento completo
          <ExternalLink size={13} />
        </a>

        {erro && <p className="text-destructive text-sm">{erro}</p>}

        {pendentes.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Documento {indice + 1} de {pendentes.length}
          </p>
        )}

        <Button onClick={aceitar} disabled={loading} className="w-full h-11 font-bold">
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Aceitar e continuar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
