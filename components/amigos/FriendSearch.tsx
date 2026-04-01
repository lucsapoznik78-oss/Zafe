"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, UserPlus, Clock, Check, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";

interface ProfileRow {
  id: string;
  username: string;
  full_name: string;
}

interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: string;
}

export default function FriendSearch({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState<ProfileRow[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: users }, { data: fs }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name")
          .neq("id", currentUserId)
          .eq("is_admin", false)
          .order("full_name", { ascending: true })
          .limit(100),
        supabase
          .from("friendships")
          .select("requester_id, addressee_id, status")
          .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`),
      ]);
      setAllUsers(users ?? []);
      setFriendships(fs ?? []);
      setLoading(false);
    }
    load();
  }, [currentUserId]);

  function getFriendshipStatus(userId: string) {
    const fs = friendships.find(
      (f) =>
        (f.requester_id === currentUserId && f.addressee_id === userId) ||
        (f.addressee_id === currentUserId && f.requester_id === userId)
    );
    if (!fs) return null;
    return { status: fs.status, isSender: fs.requester_id === currentUserId };
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

  async function acceptFriend(requesterId: string) {
    setAdding(requesterId);
    await fetch("/api/amigos/aceitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requester_id: requesterId }),
    });
    setAdding(null);
    router.refresh();
  }

  const filtered = allUsers.filter((u) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q);
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">Usuários</h3>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nome ou usuário..."
          className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {filtered.map((profile) => {
            const initials = profile.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
            const fs = getFriendshipStatus(profile.id);
            const isLoading = adding === profile.id;

            return (
              <div key={profile.id} className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground">@{profile.username}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {fs?.status === "accepted" ? (
                    <span className="flex items-center gap-1 text-xs text-sim font-medium">
                      <Check size={12} /> Amigos
                    </span>
                  ) : fs?.status === "pending" && fs.isSender ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={12} /> Pendente
                    </span>
                  ) : fs?.status === "pending" && !fs.isSender ? (
                    <button
                      onClick={() => acceptFriend(profile.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-sim/15 text-sim rounded-lg hover:bg-sim/25 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Aceitar
                    </button>
                  ) : (
                    <button
                      onClick={() => addFriend(profile.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                      Adicionar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
