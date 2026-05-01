"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, TrendingUp, Zap, Trophy, ArrowRight, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface FeaturedTopic {
  id: string;
  title: string;
  category: string;
  slug: string | null;
  prob_sim: string;
  prob_nao: string;
  total_volume: string;
}

function Confetti() {
  const colors = ["#86efac", "#f87171", "#facc15", "#60a5fa", "#e879f9", "#fb923c"];
  const pieces = Array.from({ length: 36 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {pieces.map((_, i) => {
        const color = colors[i % colors.length];
        const left = `${(i * 13 + 7) % 97}%`;
        const delay = `${(i * 0.08).toFixed(2)}s`;
        const size = 6 + (i % 5) * 2;
        return (
          <div
            key={i}
            className="absolute top-0 animate-confetti-fall"
            style={{
              left,
              animationDelay: delay,
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: i % 3 === 0 ? "50%" : "2px",
              transform: `rotate(${i * 47}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function WelcomeModal() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [featured, setFeatured] = useState<FeaturedTopic | null>(null);
  const [loadingTopic, setLoadingTopic] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    if (!localStorage.getItem("onboarding_done")) {
      setShow(true);
      loadFeatured();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFeatured() {
    setLoadingTopic(true);
    try {
      const res = await fetch("/api/onboarding/featured-topic");
      if (res.ok) setFeatured(await res.json());
    } finally {
      setLoadingTopic(false);
    }
  }

  function dismiss() {
    localStorage.setItem("onboarding_done", "1");
    setShow(false);
  }

  function next() {
    if (step < 2) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  }

  function goToTopic() {
    if (!featured) return;
    dismiss();
    const path = featured.slug ? `/topicos/${featured.slug}` : `/topicos/${featured.id}`;
    router.push(path);
  }

  if (!show) return null;

  const probSim = parseFloat(featured?.prob_sim ?? "0.5") * 100;
  const probNao = parseFloat(featured?.prob_nao ?? "0.5") * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">

        {/* Step 0: Boas-vindas */}
        {step === 0 && (
          <div className="p-6 space-y-5">
            <button onClick={dismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-white transition-colors">
              <X size={16} />
            </button>
            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={28} className="text-primary" />
              </div>
              <h2 className="text-xl font-black text-white">Bem-vindo à Zafe!</h2>
              <p className="text-sm text-muted-foreground">O mercado de previsões brasileiro</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                <Zap size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Aposte em eventos reais</p>
                  <p className="text-xs text-muted-foreground">Política, esportes, economia — tudo verificável</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                <TrendingUp size={16} className="text-sim shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Ganhe com suas previsões</p>
                  <p className="text-xs text-muted-foreground">Quem acerta divide o prêmio dos perdedores</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                <Trophy size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Compita em ligas</p>
                  <p className="text-xs text-muted-foreground">Crie ligas com amigos e suba no ranking</p>
                </div>
              </div>
            </div>
            <button
              onClick={next}
              className="w-full py-3 bg-primary text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
            >
              Começar <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Step 1: Tópico em destaque */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <button onClick={dismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-white transition-colors">
              <X size={16} />
            </button>
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Mercado em destaque</p>
              <h2 className="text-lg font-black text-white leading-tight">
                {loadingTopic ? "Carregando..." : featured?.title ?? "Explore os mercados"}
              </h2>
            </div>

            {featured && !loadingTopic && (
              <>
                {/* Barra SIM/NÃO */}
                <div className="space-y-2">
                  <div className="flex overflow-hidden rounded-lg h-5">
                    <div
                      className="bg-sim flex items-center justify-center text-[10px] font-bold text-black"
                      style={{ width: `${probSim}%` }}
                    >
                      {probSim.toFixed(0)}%
                    </div>
                    <div
                      className="bg-nao flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ width: `${probNao}%` }}
                    >
                      {probNao.toFixed(0)}%
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span className="text-sim font-semibold">SIM {probSim.toFixed(1)}%</span>
                    <span className="text-xs">{formatCurrency(parseFloat(featured.total_volume))} apostados</span>
                    <span className="text-nao font-semibold">NÃO {probNao.toFixed(1)}%</span>
                  </div>
                </div>

                <button
                  onClick={goToTopic}
                  className="w-full py-3 bg-primary text-black font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors"
                >
                  Ver e apostar
                </button>
                <button
                  onClick={next}
                  className="w-full text-xs text-muted-foreground hover:text-white transition-colors"
                >
                  Explorar depois
                </button>
              </>
            )}

            {(!featured || loadingTopic) && (
              <button
                onClick={next}
                className="w-full py-3 bg-primary text-black font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors"
              >
                Explorar mercados
              </button>
            )}
          </div>
        )}

        {/* Step 2: Confetti + conclusão */}
        {step === 2 && (
          <>
            <Confetti />
            <div className="relative p-6 space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-sim/20 flex items-center justify-center mx-auto">
                <Check size={32} className="text-sim" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white">Tudo pronto!</h2>
                <p className="text-sm text-muted-foreground">
                  Você ganhou <span className="text-primary font-bold">Z$200</span> de bônus de boas-vindas para começar.
                </p>
              </div>
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-left space-y-1.5">
                <p className="text-xs text-primary font-semibold">Dica rápida</p>
                <p className="text-xs text-muted-foreground">
                  Escolha mercados com boas probabilidades, analise as odds e diversifique suas apostas. Boa sorte!
                </p>
              </div>
              <button
                onClick={dismiss}
                className="w-full py-3 bg-primary text-black font-bold rounded-xl text-sm hover:bg-primary/90 transition-colors"
              >
                Começar a apostar
              </button>
            </div>
          </>
        )}

        {/* Indicador de etapas */}
        <div className="flex justify-center gap-1.5 pb-4">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? "w-5 bg-primary" : s < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
