import ConcursoNav from "@/components/layout/ConcursoNav";

export default function ConcursoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      <ConcursoNav />
      <main className="pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] max-w-5xl mx-auto px-4">{children}</main>
    </div>
  );
}
