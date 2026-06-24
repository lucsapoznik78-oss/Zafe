import ConcursoNav from "@/components/layout/ConcursoNav";

export default function ConcursoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      <ConcursoNav />
      <main className="pt-14 pb-16 max-w-5xl mx-auto px-4">{children}</main>
    </div>
  );
}
