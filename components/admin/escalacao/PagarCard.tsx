"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Props {
  cardId: string;
  status: string;
  /** O que a conferência acabou de calcular. Vai de volta como confirmação. */
  zAEmitir: number;
  estouraTeto: boolean;
  problemas: number;
}

/**
 * O botão que emite moeda. Digitar o valor não é cerimônia: é o mesmo número
 * que o servidor recomputa antes de chamar a RPC, então se a apuração mudou
 * entre o render desta página e o clique, o pagamento é recusado em vez de
 * emitir um valor que ninguém olhou.
 */
export default function PagarCard({
  cardId,
  status,
  zAEmitir,
  estouraTeto,
  problemas,
}: Props) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (status === "pago") {
    return <p className="text-xs text-sim">Card pago. Os Z$ já estão nas carteiras.</p>;
  }
  if (status === "cancelado") {
    return <p className="text-xs text-muted-foreground">Card cancelado e reembolsado.</p>;
  }
  if (status !== "apurado") {
    return (
      <p className="text-[11px] text-muted-foreground">
        Pagar só depois de apurar. Status atual: <span className="text-foreground">{status}</span>.
      </p>
    );
  }

  const confere = Math.abs(Number(valor.replace(",", ".")) - zAEmitir) < 0.005;
  const travado = estouraTeto || !confere || rodando;

  async function pagar() {
    setErro(null);
    setOk(null);
    setRodando(true);
    try {
      const res = await fetch(`/api/admin/escalacao/${cardId}/pagar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmacao_z: Number(valor.replace(",", ".")) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Falha ao pagar");
        return;
      }
      setOk(`${json.times} times pagos · ${json.z_emitido} Z$ emitidos`);
      router.refresh();
    } catch {
      setErro("Falha de rede");
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="space-y-2">
      {estouraTeto ? (
        <p className="text-[11px] text-nao">
          A emissão estoura o teto do card. O banco recusaria o pagamento inteiro — investigue a
          pontuação antes de mexer no teto.
        </p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Digite <span className="text-foreground tabular-nums">{zAEmitir}</span> para confirmar que
            é este o valor a emitir. Pagar é de mão única.
            {problemas > 0 && (
              <span className="text-nao">
                {" "}
                Há {problemas} inconsistência(s) acima — resolva antes.
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-input border border-border text-xs text-foreground tabular-nums"
            />
            <button
              onClick={pagar}
              disabled={travado}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
            >
              {rodando ? <Loader2 size={12} className="animate-spin" /> : "Pagar e emitir Z$"}
            </button>
          </div>
        </>
      )}
      {erro && <p className="text-xs text-nao">{erro}</p>}
      {ok && <p className="text-xs text-sim">{ok}</p>}
    </div>
  );
}
