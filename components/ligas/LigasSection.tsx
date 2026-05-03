"use client";

import { useState, useEffect } from "react";
import { Trophy, Plus, Globe, Lock, Search, Users, Loader2 } from "lucide-react";
import LigaCard from "./LigaCard";
import CreateLigaModal from "./CreateLigaModal";
import { useRouter } from "next/navigation";

interface Liga {
  id: string;
  name: string;
  description: string | null;
  color: string;
  creator_id: string;
  is_public: boolean;
  parent_liga_id: string | null;
  members: any[];
}

interface Props {
  ligas: Liga[];
  currentUserId: string;
  friends: { id: string; username: string; full_name: string }[];
}

interface PublicLiga {
  id: string;
  name: string;
  description: string | null;
  color: string;
  member_count: number;
}

export default function LigasSection({ ligas, currentUserId, friends }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [activeSection, setActiveSection] = useState<"privadas" | "publicas">("privadas");
  const [publicLigas, setPublicLigas] = useState<PublicLiga[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [joining, setJoining] = useState<string | null>(null);

  // Split user's leagues by type
  const rootLigas = ligas.filter((l) => !l.parent_liga_id);
  const subLigasMap = new Map<string, Liga[]>();
  for (const l of ligas) {
    if (l.parent_liga_id) {
      if (!subLigasMap.has(l.parent_liga_id)) subLigasMap.set(l.parent_liga_id, []);
      subLigasMap.get(l.parent_liga_id)!.push(l);
    }
  }

  const privateUserLigas = rootLigas.filter((l) => !l.is_public);
  const publicUserLigas = rootLigas.filter((l) => l.is_public);

  // Leagues where user is creator and league is private (for sub-liga selector)
  const myPrivateLigas = privateUserLigas.filter((l) => l.creator_id === currentUserId);

  async function loadPublicLigas(q = "") {
    setPublicLoading(true);
    const res = await fetch(`/api/ligas/publicas?q=${encodeURIComponent(q)}`);
    if (res.ok) setPublicLigas(await res.json());
    setPublicLoading(false);
  }

  useEffect(() => {
    if (activeSection === "publicas") loadPublicLigas(searchQ);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  async function joinLiga(ligaId: string) {
    setJoining(ligaId);
    const res = await fetch("/api/ligas/entrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liga_id: ligaId }),
    });
    setJoining(null);
    if (res.ok) {
      router.refresh();
      setActiveSection("privadas"); // go back to show new member
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadPublicLigas(searchQ);
  }

  return (
    <>
      {showCreate && (
        <CreateLigaModal
          onClose={() => setShowCreate(false)}
          myPrivateLigas={myPrivateLigas.map((l) => ({ id: l.id, name: l.name }))}
        />
      )}

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Trophy size={16} className="text-primary" />
            Ligas
            {ligas.length > 0 && (
              <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs">{ligas.length}</span>
            )}
          </h3>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
          >
            <Plus size={13} />
            Nova Liga
          </button>
        </div>

        {/* Section toggle */}
        <div className="grid grid-cols-2 gap-1 bg-muted/30 rounded-lg p-1">
          <button
            onClick={() => setActiveSection("privadas")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSection === "privadas"
                ? "bg-card text-white shadow-sm"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Lock size={11} />
            Privadas
            {privateUserLigas.length > 0 && (
              <span className="px-1 py-0.5 bg-primary/20 text-primary rounded text-[10px] leading-none">
                {privateUserLigas.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection("publicas")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSection === "publicas"
                ? "bg-card text-white shadow-sm"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Globe size={11} />
            Públicas
            {publicUserLigas.length > 0 && (
              <span className="px-1 py-0.5 bg-sim/20 text-sim rounded text-[10px] leading-none">
                {publicUserLigas.length}
              </span>
            )}
          </button>
        </div>

        {/* ── PRIVADAS ── */}
        {activeSection === "privadas" && (
          <>
            {privateUserLigas.length === 0 ? (
              <div className="text-center py-5 space-y-2">
                <Lock size={28} className="mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhuma liga privada</p>
                <p className="text-xs text-muted-foreground">Crie uma liga e convide seus amigos para palpitar juntos</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-2 px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Criar liga privada
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {privateUserLigas.map((liga) => (
                  <LigaCard
                    key={liga.id}
                    liga={liga}
                    currentUserId={currentUserId}
                    friends={friends}
                    subLigas={subLigasMap.get(liga.id) ?? []}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PÚBLICAS ── */}
        {activeSection === "publicas" && (
          <div className="space-y-4">
            {/* User's public leagues */}
            {publicUserLigas.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Suas ligas públicas</p>
                {publicUserLigas.map((liga) => (
                  <LigaCard
                    key={liga.id}
                    liga={liga}
                    currentUserId={currentUserId}
                    friends={friends}
                  />
                ))}
              </div>
            )}

            {/* Discovery */}
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Descobrir ligas</p>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Buscar ligas públicas..."
                    className="w-full pl-8 pr-3 py-2 bg-input border border-border rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-2 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  Buscar
                </button>
              </form>

              {publicLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : publicLigas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {searchQ ? "Nenhuma liga encontrada" : "Nenhuma liga pública disponível"}
                </p>
              ) : (
                <div className="space-y-2">
                  {publicLigas.map((liga) => (
                    <div
                      key={liga.id}
                      className="flex items-center gap-3 p-3 bg-muted/20 border border-border rounded-xl"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${liga.color}20`, border: `1.5px solid ${liga.color}40` }}
                      >
                        <Trophy size={16} style={{ color: liga.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{liga.name}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                          <Users size={10} />
                          <span>{liga.member_count} membros</span>
                          {liga.description && <span className="truncate">· {liga.description}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => joinLiga(liga.id)}
                        disabled={joining === liga.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-sim/10 text-sim border border-sim/30 rounded-lg text-xs font-bold hover:bg-sim/20 transition-colors disabled:opacity-50 shrink-0"
                      >
                        {joining === liga.id ? <Loader2 size={11} className="animate-spin" /> : "Entrar"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-white hover:border-border/80 transition-colors"
              >
                <Globe size={13} />
                Criar liga pública
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
