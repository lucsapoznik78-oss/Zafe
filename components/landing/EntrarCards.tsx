import Link from "next/link";
import { Gift, Trophy, Check } from "lucide-react";

export default function EntrarCards() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
            Por onde você quer começar
          </h2>
          <p className="text-muted-foreground text-sm">
            Jogue de graça no site ou dispute o prêmio em dinheiro do concurso.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Site — grátis, Z$ */}
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Gift size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Jogar no site</h3>
              <p className="text-sm text-muted-foreground mt-1">
                A liga de previsões completa, de graça.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground flex-1">
              <li className="flex items-center gap-2">
                <Check size={15} className="text-primary shrink-0" /> 1.000 Z$ de presente
              </li>
              <li className="flex items-center gap-2">
                <Check size={15} className="text-primary shrink-0" /> Sem CPF, sem cartão
              </li>
              <li className="flex items-center gap-2">
                <Check size={15} className="text-primary shrink-0" /> Liga, Econômico, Privadas e Comunidade
              </li>
            </ul>
            <Link
              href="/login"
              className="w-full text-center px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              Criar conta grátis
            </Link>
          </div>

          {/* Concurso — R$, 18+, CPF */}
          <div className="bg-yellow-400/5 border border-yellow-400/30 rounded-2xl p-6 flex flex-col gap-4 hover:border-yellow-400/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-yellow-400/15 flex items-center justify-center">
              <Trophy size={20} className="text-yellow-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Concurso mensal</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Dispute o prêmio em dinheiro real via PIX.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground flex-1">
              <li className="flex items-center gap-2">
                <Check size={15} className="text-yellow-400 shrink-0" /> Prêmio em R$ pros melhores do mês
              </li>
              <li className="flex items-center gap-2">
                <Check size={15} className="text-yellow-400 shrink-0" /> Inscrição grátis · exige CPF
              </li>
              <li className="flex items-center gap-2">
                <Check size={15} className="text-yellow-400 shrink-0" /> Exclusivo para maiores de 18 anos
              </li>
            </ul>
            <Link
              href="/concurso/entrar"
              className="w-full text-center px-4 py-2.5 rounded-xl bg-yellow-400 text-black font-bold text-sm hover:bg-yellow-300 transition-colors"
            >
              Entrar no concurso
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
