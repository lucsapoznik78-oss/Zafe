"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, User, Trophy, BookOpen } from "lucide-react";

const navItems = [
  { href: "/topicos",          label: "Início",   icon: Home },
  { href: "/ranking",          label: "Ranking",  icon: Trophy },
  { href: "/amigos",           label: "Amigos",   icon: Users },
  { href: "/apostas-privadas", label: "Privadas", icon: BookOpen },
  { href: "/perfil",           label: "Perfil",   icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-black/95 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-around h-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
