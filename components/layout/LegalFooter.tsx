import Link from "next/link";

export default function LegalFooter() {
  return (
    <div className="mt-10 pt-6 border-t border-border/40 text-xs text-muted-foreground/60 space-y-2 leading-relaxed">
      <p>
        A Zafe é uma plataforma de competição de habilidade preditiva operando sob a Lei 5.768/71.
        Z$ é moeda virtual sem valor monetário real. O prêmio mensal é destinado exclusivamente
        aos vencedores do concurso de previsões. Resultados passados não garantem posições futuras no ranking.
      </p>
      <p>
        Uso restrito a maiores de 18 anos.
        Ao participar, você declara ter lido e concordado com os{" "}
        <Link href="/termos" className="underline hover:text-muted-foreground transition-colors">
          Termos de Uso
        </Link>
        {" "}e com as regras do concurso.
      </p>
    </div>
  );
}
