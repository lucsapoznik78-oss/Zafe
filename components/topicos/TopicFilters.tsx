"use client";

import { CATEGORIES } from "@/lib/utils";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const SORT_OPTIONS = [
  { value: "popular", label: "Mais populares" },
  { value: "recent", label: "Mais recentes" },
];

export default function TopicFilters({ excludeCategory }: { excludeCategory?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentSort = searchParams.get("sort") ?? "popular";
  const currentCategory = searchParams.get("category") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const visibleCategories = excludeCategory
    ? CATEGORIES.filter((c) => c.value !== excludeCategory)
    : CATEGORIES;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setParam("sort", opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              currentSort === opt.value
                ? "bg-primary text-black"
                : "bg-card border border-border text-muted-foreground hover:text-white hover:border-primary/30"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setParam("category", "")}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            !currentCategory
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-card border border-border text-muted-foreground hover:text-white"
          }`}
        >
          Todos
        </button>
        {visibleCategories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setParam("category", cat.value)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              currentCategory === cat.value
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-card border border-border text-muted-foreground hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
