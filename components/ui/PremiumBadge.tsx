import { Star } from "lucide-react";
import { PREMIUM_ENABLED } from "@/lib/flags";

/** Selo Premium reutilizável (perfil, painéis). Oculto enquanto a assinatura
 *  não está no ar (ver PREMIUM_ENABLED em lib/flags.ts). */
export default function PremiumBadge({ className = "" }: { className?: string }) {
  if (!PREMIUM_ENABLED) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 ${className}`}
    >
      <Star size={10} fill="currentColor" />
      Premium
    </span>
  );
}
