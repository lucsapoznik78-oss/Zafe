import { CATEGORIES, CATEGORY_COLORS, cn } from "@/lib/utils";
import type { TopicCategory } from "@/types/database";

export default function CategoryBadge({
  category,
  className,
}: {
  category: TopicCategory;
  className?: string;
}) {
  const label = CATEGORIES.find((c) => c.value === category)?.label ?? category;
  const color = CATEGORY_COLORS[category] ?? "bg-zinc-500/20 text-zinc-300";

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider", color, className)}>
      {label}
    </span>
  );
}
