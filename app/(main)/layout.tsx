import Navbar from "@/components/layout/Navbar";
import MobileNav from "@/components/layout/MobileNav";
import ReferralActivator from "@/components/layout/ReferralActivator";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="pt-14 pb-16 md:pb-0 max-w-7xl mx-auto px-4">
        {children}
      </main>
      <MobileNav />
      <ReferralActivator />
    </div>
  );
}
