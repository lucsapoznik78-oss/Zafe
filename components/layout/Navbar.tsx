"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Wallet, Info } from "lucide-react";
import NotificationBell from "@/components/layout/NotificationBell";
import PushSetup from "@/components/layout/PushSetup";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile, Wallet as WalletType } from "@/types/database";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletType | null>(null);

  useEffect(() => {
    let userId: string | null = null;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      const [{ data: prof }, { data: wal }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("wallets").select("*").eq("user_id", user.id).single(),
      ]);

      setProfile(prof);
      setWallet(wal);
    }

    async function refreshBalance() {
      if (!userId) return;
      const { data: wal } = await supabase.from("wallets").select("*").eq("user_id", userId).single();
      if (wal) setWallet(wal);
    }

    load();
    const interval = setInterval(refreshBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between h-full px-4 max-w-7xl mx-auto">
        <Link href="/liga" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">Zafe</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { href: "/liga", label: "Liga" },
            { href: "/economico", label: "Econômico" },
            { href: "/ranking", label: "Ranking" },
            { href: "/amigos", label: "Amigos" },
            { href: "/privadas", label: "Privadas" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block group">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium cursor-default">
              <Wallet size={14} />
              {wallet ? formatCurrency(wallet.balance) : "Z$ 0,00"}
              <Info size={11} className="text-primary/50" />
            </span>
            {/* Tooltip */}
            <div className="pointer-events-none absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-card px-3 py-2.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
              <p className="text-xs font-semibold text-white mb-1">Z$ — moeda virtual</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Z$ é a moeda virtual da Zafe. <span className="text-white font-medium">Não tem valor monetário real</span> e não pode ser convertida em dinheiro.
              </p>
            </div>
          </div>

          <PushSetup />
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="h-8 w-8 border border-border cursor-pointer">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border">
              <DropdownMenuItem onClick={() => window.location.href = "/perfil"}>
                <span className="text-sm">Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = "/meus-topicos"}>
                <span className="text-sm">Minhas Posições</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                <LogOut size={14} className="mr-2" />
                <span className="text-sm">Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
