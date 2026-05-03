"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("search") ?? "");

  // Rota base: preserva /liga ou /economico; fallback para /liga
  const basePath = pathname.startsWith("/economico") ? "/economico" : "/liga";

  const debounce = useCallback(
    (fn: (v: string) => void, delay: number) => {
      let timeout: NodeJS.Timeout;
      return (v: string) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(v), delay);
      };
    },
    []
  );

  const updateSearch = debounce((v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set("search", v);
    else params.delete("search");
    router.push(`${basePath}?${params.toString()}`);
  }, 300);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    updateSearch(e.target.value);
  }

  function handleClear() {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Buscar eventos..."
        className="w-full bg-card border border-border rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
