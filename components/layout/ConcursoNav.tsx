"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Trophy } from "lucide-react";
import NotificationBell from "@/components/layout/NotificationBell";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/types/database";

export default function ConcursoNav() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/carteira", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.profile) setProfile(data.profile);
      } catch {}
    }
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") load();
    });
    return () => subscription.unsubscribe();
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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-yellow-400/20 bg-black/90 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 max-w-5xl mx-auto">
        <Link href="/concurso" className="flex items-center gap-2">
          <Trophy size={18} className="text-yellow-400" />
          <span className="font-black text-white text-sm">
            Concurso <span className="text-yellow-400">Zafe</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/liga"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors border border-border/60"
          >
            <ArrowLeft size={13} />
            <span>Zona grátis</span>
          </Link>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Avatar className="h-8 w-8 cursor-pointer border border-border">
                <AvatarFallback className="bg-yellow-400/20 text-yellow-400 text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border">
              <DropdownMenuItem onClick={() => (window.location.href = "/perfil")}>
                <span className="text-sm">Meu Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => (window.location.href = "/liga")}>
                <span className="text-sm">Ir para a Zona grátis</span>
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
