import Link from "next/link";

export default function LegalFooter() {
  return (
    <div className="mt-10 pt-6 border-t border-border/40 text-xs text-muted-foreground/60 space-y-2 leading-relaxed">
      <p>
        <span className="text-muted-foreground font-medium">Aviso de risco:</span>{" "}
        Investir em mercados de previsão envolve risco de perda total do valor aplicado.
        A Zafe não garante resultados e não se responsabiliza por perdas decorrentes de decisões de investimento dos usuários.
        Os resultados passados não são garantia de resultados futuros.
        Participe somente com valores que esteja disposto a perder.
      </p>
      <p>
        O uso da plataforma é restrito a maiores de 18 anos.
        Ao investir, você declara ter lido e concordado com os{" "}
        <Link href="/termos" className="underline hover:text-muted-foreground transition-colors">
          Termos de Uso
        </Link>
        {" "}e reconhece que é o único responsável pelas suas decisões financeiras na plataforma.
      </p>
    </div>
  );
}
