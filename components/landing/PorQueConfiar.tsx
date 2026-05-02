import { ShieldCheck, Coins, Zap } from "lucide-react";

const points = [
  {
    icon: Coins,
    title: "A Zafe nunca pega seu dinheiro pra te devolver depois",
    body: "Você nunca faz depósito. Z$ é virtual e grátis — não tem como perder dinheiro real jogando na liga.",
  },
  {
    icon: ShieldCheck,
    title: "Você compete em moeda virtual, sem risco financeiro",
    body: "Z$ não tem valor em Real e não é conversível. A competição é de habilidade pura — quem prevê melhor, vence.",
  },
  {
    icon: Zap,
    title: "O prêmio do concurso vai direto pro seu PIX",
    body: "Sem saque pendente. Sem taxa de retirada. O valor cai na sua conta assim que o mês fecha.",
  },
];

export default function PorQueConfiar() {
  return (
    <section className="py-16 px-4 bg-card/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
            Por que confiar na Zafe?
          </h2>
          <p className="text-muted-foreground text-sm">
            Transparência total sobre como o modelo funciona.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {points.map((p, i) => (
            <div
              key={i}
              className="flex gap-4 p-5 bg-card border border-border rounded-2xl"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <p.icon size={18} className="text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white leading-snug">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
