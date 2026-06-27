import Link from "next/link";

export default function LegalFooter() {
  return (
    <div className="mt-10 pt-6 border-t border-border/40 text-xs text-muted-foreground/60 space-y-2 leading-relaxed">
      <p>
        A Zafe é um fantasy game de habilidade de esporte e e-sports, enquadrado como fantasy sport
        pelo Art. 49 da Lei 14.790/2023. Z$ é moeda virtual sem valor monetário real. O prêmio do
        Concurso é fixo, definido na abertura e independente do número de inscritos. Resultados passados
        não garantem posições futuras no ranking.
      </p>
      <p>
        Uso restrito a maiores de 18 anos.
        Ao participar, você declara ter lido e concordado com os{" "}
        <Link href="/termos" className="underline hover:text-muted-foreground transition-colors">
          Termos de Uso
        </Link>
        {" "}e com as regras do concurso.
      </p>
      <p>
        Jogue com responsabilidade.{" "}
        <Link href="/jogo-responsavel" className="underline hover:text-muted-foreground transition-colors">
          Jogo responsável
        </Link>
        {" "}— pausa, autoexclusão e canais de ajuda.
      </p>
    </div>
  );
}
