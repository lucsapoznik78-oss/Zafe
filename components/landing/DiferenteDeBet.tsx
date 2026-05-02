import { Scale } from "lucide-react";

export default function DiferenteDeBet() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Scale size={18} className="text-primary" />
            </div>
            <h2 className="text-base font-bold text-white">
              Diferente de casa de jogos
            </h2>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            A Zafe é uma{" "}
            <span className="text-white font-semibold">competição de habilidade</span>{" "}
            — quem prevê melhor, ganha. O modelo é o mesmo do xadrez online ou de
            competições de palpites entre amigos. Você não compete contra a
            plataforma: compete contra outros previsores.
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Operamos sob a{" "}
            <span className="text-white font-medium">Lei 5.768/71</span>{" "}
            (concurso de previsões) e não sob a Lei 14.790/23, que regula casas de
            jogos de quota fixa. Não somos uma casa de jogos e não pretendemos ser.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {[
              { label: "Z$ é virtual", sub: "Não há depósito nem valor real envolvido" },
              { label: "Prêmio de concurso", sub: "Regulamentado como competição de habilidade" },
              { label: "Sem fixação de quota", sub: "Pool parimutuel entre participantes" },
              { label: "Transparência total", sub: "Probabilidades visíveis e auditáveis" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                <span className="text-primary text-sm mt-0.5">✓</span>
                <div>
                  <p className="text-xs font-semibold text-white">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
