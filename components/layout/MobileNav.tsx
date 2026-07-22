"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Trophy, FlaskConical, Gamepad2 } from "lucide-react";

const navItems = [
  { href: "/liga",        label: "Liga",       icon: Home },
  { href: "/comunidade", label: "Comunidade", icon: FlaskConical },
  { href: "/games",      label: "Games",      icon: Gamepad2 },
  { href: "/ranking",    label: "Ranking",    icon: Trophy },
  { href: "/perfil",     label: "Perfil",     icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-black/95 backdrop-blur-sm md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
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
