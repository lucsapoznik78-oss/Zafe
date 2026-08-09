import Link from "next/link";
import { Check, Plus, PencilLine } from "lucide-react";

import { corDoEsporte } from "@/components/escalacao/FotoAtleta";
import type { CardPublico } from "@/lib/escalacao/publico";

/**
 * As Convocações lado a lado, cada uma com o estado do time do usuário.
 *
 * O seletor antigo era uma fileira de pílulas com o nome do card, e ele escondia
 * a regra mais importante do modo: **as Convocações são independentes**. Quem via
 * abas assumia que estava trocando de visão de um campeonato só, e não que podia
 * montar um time em cada uma. Aqui cada Convocação é um card com preço, tamanho
 * de time e o próprio estado — a soma dos "inscrito" no topo é a resposta visual
 * para "quantos times eu posso ter?".
 */

const ESTADOS_INSCRITO = new Set(["inscrito", "travado", "apurado", "pago"]);

function nomeCurto(card: CardPublico): string {
  return card.modo === "mix" ? "Mix" : card.titulo.split(" — ")[0];
}

export default function SeletorConvocacoes({
  cards,
  atual,
  meusTimes,
}: {
  cards: CardPublico[];
  atual: string;
  /** `card_id → status`. Vazio para quem não está logado. */
  meusTimes: Record<string, string>;
}) {
  const inscritos = cards.filter((c) => ESTADOS_INSCRITO.has(meusTimes[c.id] ?? "")).length;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          São <strong className="text-white">{cards.length} Convocações independentes</strong> —
          você pode montar um time em cada uma.
        </p>
        <span className="text-[11px] font-bold shrink-0 text-white tabular-nums">
          {inscritos}/{cards.length}
        </span>
      </div>

      <nav
        aria-label="Convocações"
        className="grid grid-flow-col auto-cols-[9.5rem] gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 lg:grid-cols-5"
      >
        {cards.map((c) => {
          const status = meusTimes[c.id];
          const inscrito = ESTADOS_INSCRITO.has(status ?? "");
          const selecionado = c.id === atual;

          return (
            <Link
              key={c.id}
              href={`/escalacao?c=${c.id}`}
              aria-current={selecionado ? "page" : undefined}
              className={`relative rounded-xl border p-2.5 transition-colors ${
                selecionado
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-white/25"
              }`}
            >
              <span
                aria-hidden="true"
                className={`block h-1 w-8 rounded-full mb-2 bg-gradient-to-r ring-1 ${corDoEsporte(
                  c.esportes[0] ?? ""
                )}`}
              />
              <span className="block text-sm font-bold text-white truncate">{nomeCurto(c)}</span>
              <span className="block text-[10px] text-muted-foreground">
                {c.modo === "mix" ? `${c.esportes.length} esportes` : "liga única"} ·{" "}
                {c.n_titulares}+{c.n_reservas}
              </span>
              <span
                className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold ${
                  inscrito ? "text-sim" : status ? "text-white/70" : "text-muted-foreground"
                }`}
              >
                {inscrito ? (
                  <>
                    <Check size={11} /> Inscrito
                  </>
                ) : status ? (
                  <>
                    <PencilLine size={11} /> Rascunho
                  </>
                ) : (
                  <>
                    <Plus size={11} /> {c.entrada_z} Z$
                  </>
                )}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
