import Link from "next/link";

export default function CtaFinal() {
  return (
    <section className="py-20 px-4 text-center">
      <div className="max-w-lg mx-auto space-y-6">
        <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
          Pronto pra começar?
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Cadastro leva 30 segundos. Você sai com 1.000 Z$ na mão e o ranking
          do mês esperando.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/concurso/entrar"
            className="px-8 py-3.5 rounded-xl bg-primary text-black font-bold text-base hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/liga"
            className="px-8 py-3.5 rounded-xl border border-border text-white font-medium text-base hover:border-primary/40 hover:bg-white/5 transition-colors"
          >
            Ver eventos primeiro
          </Link>
        </div>
        <p className="text-xs text-muted-foreground/50">
          1.000 Z$ de presente. Sem depósito, sem cartão.
        </p>
      </div>
    </section>
  );
}
