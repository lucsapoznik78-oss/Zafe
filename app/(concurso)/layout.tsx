import { Suspense } from "react";
import ConcursoNav from "@/components/layout/ConcursoNav";
import ReaceiteGate from "@/components/legal/ReaceiteGate";

export default function ConcursoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      <ConcursoNav />
      <main className="pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] max-w-5xl mx-auto px-4">{children}</main>
      <Suspense fallback={null}>
        <ReaceiteGate />
      </Suspense>
    </div>
  );
}
