"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/database";

export default function FriendSearch({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .neq("id", currentUserId)
      .limit(5);
    setResults(data ?? []);
    setSearching(false);
  }

  async function addFriend(addresseeId: string) {
    setAdding(addresseeId);
    await fetch("/api/amigos/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressee_id: addresseeId }),
    });
    setAdding(null);
    router.refresh();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white">Buscar Amigos</h3>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou usuário..."
            className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          {searching ? <Loader2 size={14} className="animate-spin" /> : "Buscar"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((profile) => {
            const initials = profile.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
            return (
              <div key={profile.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">@{profile.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => addFriend(profile.id)}
                  disabled={adding === profile.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {adding === profile.id ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                  Adicionar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
