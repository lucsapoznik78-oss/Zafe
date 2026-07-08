"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Wallet, Info, Star, Trophy } from "lucide-react";
import NotificationBell from "@/components/layout/NotificationBell";
import PushSetup from "@/components/layout/PushSetup";
import SoundMenu from "@/components/layout/SoundMenu";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { isPremium } from "@/lib/premium";
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
    // Busca via API (auth por cookie, leitura server-side): a query direta
    // de `wallets` pelo browser falhava em algumas sessões e o saldo ficava
    // vazio mesmo com Z$ na carteira.
    async function load() {
      try {
        const res = await fetch("/api/carteira", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile) setProfile(data.profile);
        if (data.wallet) setWallet(data.wallet);
      } catch {}
    }

    load();
    // Re-carrega quando a sessão muda (login, refresh de token) — sem isso,
    // se o Navbar montar antes da sessão estar pronta o saldo fica "0" até um hard refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") load();
    });
    const interval = setInterval(load, 30000);
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
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

  const premium = isPremium(profile);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-black/90 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 max-w-7xl mx-auto">
        <Link href="/inicio" className="flex items-center gap-2">
          <img src="/zafe-logo-full.png" alt="Zafe" className="h-8 hidden sm:block" />
          <img src="/zafe-icon.png" alt="Zafe" className="h-8 w-8 sm:hidden rounded" />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { href: "/liga", label: "Liga" },
            { href: "/copa", label: "Copa" },
            { href: "/comunidade", label: "Comunidade" },
            { href: "/games", label: "Games" },
            { href: "/privadas", label: "Privadas" },
            { href: "/ranking", label: "Ranking" },
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

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Porta do mundo PAGO — destacada, separada da zona grátis */}
          <Link
            href="/concurso"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md bg-yellow-400 text-black text-sm font-bold hover:bg-yellow-300 transition-colors"
          >
            <Trophy size={14} />
            <span>Concurso</span>
            <span className="hidden lg:inline font-semibold text-black/70">· Prêmio R$</span>
          </Link>

          <div className="relative group">
            <button type="button" className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs sm:text-sm font-medium cursor-default">
              <Wallet size={14} />
              {wallet ? formatCurrency(wallet.balance) : "Z$ —"}
              <Info size={11} className="text-primary/50" />
            </button>
            {/* Tooltip (hover no desktop, toque/focus no mobile) */}
            <div className="pointer-events-none absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-card px-3 py-2.5 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50">
              <p className="text-xs font-semibold text-white mb-1">Z$ — moeda virtual</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Z$ é a moeda virtual da Zafe. <span className="text-white font-medium">Não tem valor monetário real</span> e não pode ser convertida em dinheiro.
              </p>
            </div>
          </div>

          <div className="hidden sm:block">
            <SoundMenu />
          </div>
          <PushSetup />
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="relative">
                <Avatar
                  className={`h-8 w-8 cursor-pointer ${
                    premium ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-black" : "border border-border"
                  }`}
                >
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {premium && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-black">
                    <Star size={11} className="text-yellow-400" fill="currentColor" />
                  </span>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border">
              <DropdownMenuItem onClick={() => window.location.href = "/perfil"}>
                <span className="text-sm">Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = "/meus-topicos"}>
                <span className="text-sm">Minhas Posições</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = "/privadas"} className="md:hidden">
                <span className="text-sm">Privadas</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.location.href = "/premium"}>
                <Star size={14} className="mr-2 text-yellow-400" />
                <span className="text-sm">Premium</span>
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
