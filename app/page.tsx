export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import LandingHeader from "@/components/landing/LandingHeader";
import Hero from "@/components/landing/Hero";
import EntrarCards from "@/components/landing/EntrarCards";
import HowItWorks from "@/components/landing/HowItWorks";
import ConcursoAtivo from "@/components/landing/ConcursoAtivo";
import EventosEmAlta from "@/components/landing/EventosEmAlta";
import PorQueConfiar from "@/components/landing/PorQueConfiar";
import DiferenteDeBet from "@/components/landing/DiferenteDeBet";
import CtaFinal from "@/components/landing/CtaFinal";
import LandingFooter from "@/components/landing/LandingFooter";
import { CONCURSO_ENABLED } from "@/lib/flags";

const META_DESC = CONCURSO_ENABLED
  ? "Compete prevendo o que vai acontecer. Receba 1.000 Z$ grátis ao criar conta e dispute o prêmio mensal com os melhores previsores do Brasil."
  : "Compete prevendo esporte e e-sports. Receba 1.000 Z$ grátis ao criar conta e suba no ranking dos melhores previsores do Brasil. Sem depósito, sem cartão.";

const META_SHARE_DESC = CONCURSO_ENABLED
  ? "Compete prevendo o que vai acontecer. Prêmio mensal em PIX pros melhores. Sem depósito, sem cartão."
  : "Compete prevendo esporte e e-sports com Z$ virtual. Sem depósito, sem cartão.";

export const metadata: Metadata = {
  title: "Zafe — A liga das previsões",
  description: META_DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zafe — A liga das previsões",
    description: META_SHARE_DESC,
    type: "website",
    siteName: "Zafe",
    url: "https://www.zafe.app.br",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zafe — A liga das previsões",
    description: META_SHARE_DESC,
  },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/inicio");

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />

      <main>
        <Hero />

        <div className="border-t border-border/20" />
        <EntrarCards />

        <div className="border-t border-border/20" />
        <HowItWorks />

        <div className="border-t border-border/20" />
        <Suspense fallback={<div className="py-16" />}>
          <ConcursoAtivo />
        </Suspense>

        <div className="border-t border-border/20" />
        <Suspense fallback={<div className="py-16" />}>
          <EventosEmAlta />
        </Suspense>

        <div className="border-t border-border/20" />
        <PorQueConfiar />

        <div className="border-t border-border/20" />
        <DiferenteDeBet />

        <div className="border-t border-border/20" />
        <CtaFinal />
      </main>

      <LandingFooter />
    </div>
  );
}
