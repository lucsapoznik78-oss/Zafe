export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import LandingHeader from "@/components/landing/LandingHeader";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import ConcursoAtivo from "@/components/landing/ConcursoAtivo";
import EventosEmAlta from "@/components/landing/EventosEmAlta";
import PorQueConfiar from "@/components/landing/PorQueConfiar";
import DiferenteDeBet from "@/components/landing/DiferenteDeBet";
import CtaFinal from "@/components/landing/CtaFinal";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "Zafe — A liga das previsões",
  description:
    "Compete prevendo o que vai acontecer. Receba 1.000 Z$ grátis ao criar conta e dispute o prêmio mensal com os melhores previsores do Brasil.",
  openGraph: {
    title: "Zafe — A liga das previsões",
    description:
      "Compete prevendo o que vai acontecer. Prêmio mensal em PIX pros melhores. Sem depósito, sem cartão.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zafe — A liga das previsões",
    description:
      "Compete prevendo o que vai acontecer. Prêmio mensal em PIX pros melhores. Sem depósito, sem cartão.",
  },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/liga");

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />

      <main>
        <Hero />

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
