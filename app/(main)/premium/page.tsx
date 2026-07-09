import Link from "next/link";
import { Check, Star, Sparkles, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPremium } from "@/lib/premium";

export const metadata = { title: "Premium — Zafe" };

const FEATURES_FREE = [
  "Palpites ilimitados (Z$ virtual)",
  "Acesso a todos os setores públicos",
  "Histórico de palpites",
  "Ranking geral",
];

const FEATURES_PREMIUM = [
  "Tudo do plano gratuito",
  "Insights exclusivos em cada evento (pesquisas, histórico e contexto)",
  "Bônus semanal turbinado em Z$",
  "Badge Premium no perfil",
];

export default async function PremiumPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userIsPremium = false;
  let premiumUntil: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, premium_until")
      .eq("id", user.id)
      .maybeSingle();
    userIsPremium = isPremium(profile);
    premiumUntil = profile?.premium_until ?? null;
  }

  return (
    <div className="py-6 space-y-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-full px-3 py-1 text-xs font-semibold text-primary mb-2">
          <Star size={11} />
          Zafe Premium
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Leve seus palpites a sério</h1>
        <p className="text-muted-foreground text-sm">
          Recursos avançados para previsores que querem acompanhar o mercado de verdade.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 gap-4">
        {/* Free plan */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gratuito</p>
            <p className="text-3xl font-bold text-white mt-1">R$ 0</p>
            <p className="text-xs text-muted-foreground">para sempre</p>
          </div>
          <ul className="space-y-2">
            {FEATURES_FREE.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check size={14} className="text-sim shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {user ? (
            <div className="w-full py-2.5 rounded-lg border border-border text-center text-sm text-muted-foreground font-medium">
              Seu plano atual
            </div>
          ) : (
            <Link href="/login" className="block w-full py-2.5 rounded-lg border border-border text-center text-sm text-white font-medium hover:bg-muted/30 transition-colors">
              Começar grátis
            </Link>
          )}
        </div>

        {/* Premium plan */}
        <div className="bg-card border border-primary/50 rounded-xl p-5 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg">
            MAIS POPULAR
          </div>
          <div>
            <p className="text-xs text-primary font-medium uppercase tracking-wide flex items-center gap-1">
              <Star size={10} />
              Premium
            </p>
            <div className="flex items-end gap-1.5 mt-1">
              <p className="text-3xl font-bold text-white">R$ 19,90</p>
              <p className="text-xs text-muted-foreground mb-1">/mês</p>
            </div>
            <p className="text-xs text-muted-foreground">ou R$ 179,90/ano — economize 25%</p>
          </div>
          <ul className="space-y-2">
            {FEATURES_PREMIUM.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-white">
                <Check size={14} className="text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {userIsPremium ? (
            <div className="w-full py-3 rounded-lg bg-primary/15 border border-primary/40 text-center text-sm text-primary font-bold flex items-center justify-center gap-1.5">
              <Sparkles size={14} />
              Você é Premium
              {premiumUntil && (
                <span className="font-normal text-xs text-muted-foreground">
                  (até {new Date(premiumUntil).toLocaleDateString("pt-BR")})
                </span>
              )}
            </div>
          ) : (
            <>
              <div className="w-full py-3 rounded-lg bg-muted/40 border border-border text-center text-sm text-muted-foreground font-bold cursor-not-allowed">
                Em breve
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Disponível em breve — fique de olho.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Feature highlights */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-white">O que você ganha?</p>
        <div className="grid grid-cols-1 gap-3">
          {[
            {
              icon: <Sparkles size={18} className="text-primary" />,
              title: "Insights exclusivos em cada evento",
              desc: "Resumo, dados de pesquisas, histórico e contexto de cada evento — informação para você formar sua própria opinião.",
            },
            {
              icon: <Gift size={18} className="text-primary" />,
              title: "Bônus semanal turbinado",
              desc: "Receba mais Z$ no bônus semanal do que os previsores do plano gratuito.",
            },
            {
              icon: <Star size={18} className="text-primary" />,
              title: "Badge Premium no perfil",
              desc: "Mostre que você leva seus palpites a sério com o selo Premium ao lado do seu nome.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
              <div className="shrink-0 mt-0.5">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legal note */}
      <p className="text-[11px] text-muted-foreground text-center px-4">
        A assinatura Premium é um serviço de software. Os insights são informativos e não constituem recomendação de palpite. Z$ é moeda virtual sem valor monetário real.
      </p>
    </div>
  );
}
