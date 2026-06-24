import Link from "next/link";

export default function Hero() {
  return (
    <section className="pt-16 pb-12 px-4 text-center">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Fantasy game de esporte e e-sports — Temporada aberta
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight">
          O fantasy game onde você compete{" "}
          <span className="text-primary">prevendo</span> esporte e e-sports
        </h1>

        {/* Sub */}
        <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
          Não é cassino. É um fantasy game de habilidade: jogue grátis com Z$ ou
          entre no Concurso e dispute prêmio em dinheiro real pros melhores do mês.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-primary text-black font-bold text-base hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/liga"
            className="px-6 py-3 rounded-xl border border-border text-white font-medium text-base hover:border-primary/40 hover:bg-white/5 transition-colors"
          >
            Ver eventos abertos →
          </Link>
        </div>

        {/* Microcopy */}
        <p className="text-xs text-muted-foreground/60">
          1.000 Z$ de presente ao se cadastrar. Sem depósito, sem cartão, sem pegadinha.
        </p>
      </div>
    </section>
  );
}
