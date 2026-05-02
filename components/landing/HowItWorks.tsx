import { Gift, Target, Trophy } from "lucide-react";

const steps = [
  {
    icon: Gift,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Comece com 1.000 Z$ grátis",
    body: "Crie sua conta e receba 1.000 Z$, a moeda virtual da Zafe. Sem depósito, sem cartão. Você ganha mais Z$ acertando previsões e com bônus semanais.",
  },
  {
    icon: Target,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    title: "Palpite no que você acompanha",
    body: "Esporte, política, economia, tecnologia. Centenas de eventos abertos toda semana. Diga SIM ou NÃO e aloque seus Z$ na previsão.",
  },
  {
    icon: Trophy,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    title: "Top do mês ganha em PIX",
    body: "Os melhores previsores do mês ganham prêmio em dinheiro real via PIX. Critério: maior acurácia nas previsões. Quanto mais você acerta, mais você sobe.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
            Como funciona
          </h2>
          <p className="text-muted-foreground text-sm">Três passos. Zero confusão.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl p-6 space-y-3 hover:border-primary/20 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl ${step.bg} flex items-center justify-center`}>
                <step.icon size={20} className={step.color} />
              </div>
              <div className="text-xs text-muted-foreground/50 font-semibold uppercase tracking-widest">
                Passo {i + 1}
              </div>
              <h3 className="text-base font-bold text-white leading-snug">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
