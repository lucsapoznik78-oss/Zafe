import Link from "next/link";
import { AlertCircle } from "lucide-react";

/**
 * Informação prévia e destacada sobre as condições da inscrição paga, exibida
 * acima do único CTA da tela.
 *
 * Não colapsa e não fecha de propósito: o CDC art. 54 §4º exige que cláusulas
 * restritivas de direito sejam redigidas com destaque e de leitura imediata, e o
 * Decreto 7.962/2013 arts. 2º e 4º exige que preço, condições e restrições
 * estejam à vista antes da contratação — não atrás de um "ver mais".
 */

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataHoraBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default function AvisoAntesDePagar({
  valorCentavos,
  fimEm,
}: {
  valorCentavos: number;
  fimEm: string;
}) {
  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-primary shrink-0" />
        <p className="text-sm font-bold text-white">
          Antes de pagar, entenda o que você está aceitando
        </p>
      </div>

      <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <li>
          A inscrição custa <strong className="text-white">{reais(valorCentavos)}</strong> por
          edição, em pagamento único via PIX. Não vira saldo, não é conversível em dinheiro e não
          é sacável.
        </li>
        <li>
          A premiação é <strong className="text-white">fixa</strong>, definida na abertura da
          edição, e é paga integralmente{" "}
          <strong className="text-white">independentemente do número de inscritos</strong> ou do
          valor arrecadado.
        </li>
        <li>
          Sobre o prêmio incide{" "}
          <strong className="text-white">imposto de renda retido na fonte</strong>, conforme a
          legislação tributária aplicável. O valor creditado é líquido.
        </li>
        <li>
          Esta edição vai até <strong className="text-white">{dataHoraBR(fimEm)}</strong>. Depois
          de confirmada, a inscrição em edição já em andamento{" "}
          <strong className="text-white">não é reembolsável</strong>, salvo nas hipóteses
          previstas nos Termos de Uso.
        </li>
        <li>
          Participar exige <strong className="text-white">18 anos ou mais</strong>, CPF válido de
          sua titularidade e uma única inscrição por pessoa.
        </li>
      </ul>

      <p className="text-xs text-muted-foreground">
        Regras completas no{" "}
        <Link
          href="/concurso/como-funciona"
          target="_blank"
          rel="noopener"
          className="text-primary underline"
        >
          Regulamento do Concurso
        </Link>
        .
      </p>
    </div>
  );
}
