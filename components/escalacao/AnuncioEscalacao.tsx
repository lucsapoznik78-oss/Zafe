"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Layers, Sparkles, Trophy, X } from "lucide-react";

/**
 * O aviso de estreia do Modo Escalação.
 *
 * Aparece uma vez por navegador e some para sempre — a chave é versionada
 * (`_v1`) porque um anúncio futuro vai querer reaparecer para quem já viu este.
 *
 * Três guardas de convivência, todas necessárias:
 *  - não empilha com o `WelcomeModal`: só mostra a quem já concluiu o onboarding,
 *    senão o usuário novo leva dois modais em cima do outro no primeiro login;
 *  - não abre dentro de `/escalacao` — anunciar a página em que a pessoa já está
 *    é ruído;
 *  - marca como visto ao entrar em `/escalacao` por conta própria, para não
 *    ser anunciado depois de já ter descoberto sozinho.
 */

const CHAVE = "escalacao_anuncio_v1";

export default function AnuncioEscalacao() {
  const pathname = usePathname();
  const [mostrar, setMostrar] = useState(false);
  const checado = useRef(false);

  useEffect(() => {
    if (localStorage.getItem(CHAVE)) return;

    if (pathname.startsWith("/escalacao")) {
      localStorage.setItem(CHAVE, "1");
      return;
    }

    if (checado.current) return;
    checado.current = true;
    if (localStorage.getItem("onboarding_done")) setMostrar(true);
  }, [pathname]);

  function fechar() {
    localStorage.setItem(CHAVE, "1");
    setMostrar(false);
  }

  if (!mostrar) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl">
        <button
          onClick={fechar}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-muted-foreground hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        <div className="rounded-t-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent px-6 pt-6 pb-5 text-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            <Sparkles size={11} /> Novidade
          </span>
          <h2 className="mt-3 text-2xl font-black leading-tight text-white">
            Modo Escalação
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monte seu time de atletas reais e pontue pelo que eles fizerem em campo.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-3">
            <Layers size={16} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-white">Até 5 times ao mesmo tempo</p>
              <p className="text-xs text-muted-foreground">
                Um no Mix e um em cada liga — Brasileirão, NBA, NFL e Valorant. São
                competições independentes, com ranking próprio.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-3">
            <Trophy size={16} className="mt-0.5 shrink-0 text-yellow-400" />
            <div>
              <p className="text-sm font-semibold text-white">1 ponto = 1 Z$</p>
              <p className="text-xs text-muted-foreground">
                Cada titular pontua lance a lance. A soma do time vira Z$ na sua
                carteira quando a Convocação é apurada.
              </p>
            </div>
          </div>

          <Link
            href="/escalacao"
            onClick={fechar}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            Escalar meu time <ArrowRight size={15} />
          </Link>
          <button
            onClick={fechar}
            className="w-full text-xs text-muted-foreground transition-colors hover:text-white"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
