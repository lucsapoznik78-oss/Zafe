import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import MobileNav from "@/components/layout/MobileNav";
import ReferralActivator from "@/components/layout/ReferralActivator";
import PendingPickActivator from "@/components/layout/PendingPickActivator";
import WelcomeModal from "@/components/onboarding/WelcomeModal";
import AnuncioEscalacao from "@/components/escalacao/AnuncioEscalacao";
import ReaceiteGate from "@/components/legal/ReaceiteGate";
import { ESCALACAO_ENABLED } from "@/lib/flags";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 max-w-7xl mx-auto px-4">
        {children}
      </main>
      <MobileNav />
      <ReferralActivator />
      <PendingPickActivator />
      <WelcomeModal />
      {ESCALACAO_ENABLED && <AnuncioEscalacao />}
      <Suspense fallback={null}>
        <ReaceiteGate />
      </Suspense>
    </div>
  );
}
