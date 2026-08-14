import { Star } from "lucide-react";

/** Selo Premium reutilizável (perfil, painéis). */
export default function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-prize/15 text-prize border border-prize/30 ${className}`}
    >
      <Star size={10} fill="currentColor" />
      Premium
    </span>
  );
}
