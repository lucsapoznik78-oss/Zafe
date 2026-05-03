"use client";

import { useState, useEffect } from "react";
import { Trophy, Users, ChevronRight, UserPlus, X, Check, Loader2, LogOut, Crown, TrendingUp, TrendingDown, Globe, Lock, Plus, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import CreateLigaModal from "./CreateLigaModal";

interface Member {
  id: string;
  user_id: string;
  status: string;
  profiles: { username: string; full_name: string };
}

interface Friend {
  id: string;
  username: string;
  full_name: string;
}

interface Liga {
  id: string;
  name: string;
  description: string | null;
  color: string;
  creator_id: string;
  is_public: boolean;
  parent_liga_id: string | null;
  members: Member[];
}

interface RankingEntry {
  user_id: string;
  username: string;
  full_name: string;
  profit: number;
  invested: number;
  won: number;
  total: number;
}

interface Props {
  liga: Liga;
  currentUserId: string;
  friends: Friend[];
  subLigas?: Liga[];
}

type Tab = "members" | "ranking" | "subligas";

function getInitials(name: string) {
  return name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
}

export default function LigaCard({ liga, currentUserId, friends, subLigas = [] }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>("members");
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(
    new Set<string>(liga.members.map((m: Member) => m.user_id))
  );
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; username: string; full_name: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const activeMembers = liga.members.filter((m) => m.status === "active");
  const isCreator = liga.creator_id === currentUserId;
  const isMember = liga.members.some((m) => m.user_id === currentUserId && m.status === "active");

  const tabs: Tab[] = ["members", "ranking", ...((!liga.is_public && (subLigas.length > 0 || isCreator)) ? ["subligas" as Tab] : [])];

  async function inviteFriend(friendId: string) {
    setInviting(friendId);
    await fetch("/api/ligas/convidar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liga_id: liga.id, friend_id: friendId }),
    });
    setInvited((prev) => new Set([...prev, friendId]));
    setSearchResults((prev) => prev.filter((u) => u.id !== friendId));
    setInviting(null);
  }

  async function searchUsers(q: string) {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const res = await fetch(`/api/ligas/buscar-usuarios?q=${encodeURIComponent(q)}&liga_id=${liga.id}`);
    if (res.ok) setSearchResults(await res.json());
    setSearching(false);
  }

  async function leaveLeague() {
    if (!confirm("Tem certeza que deseja sair desta liga?")) return;
    setLeaving(true);
    await fetch("/api/ligas/sair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liga_id: liga.id }),
    });
    setLeaving(false);
    router.refresh();
  }

  async function transferAdmin() {
    if (!transferTarget) return;
    const member = activeMembers.find((m) => m.user_id === transferTarget);
    if (!confirm(`Transferir liderança para ${member?.profiles?.full_name ?? "este membro"}?`)) return;
    setTransferring(true);
    await fetch("/api/ligas/transferir-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liga_id: liga.id, new_creator_id: transferTarget }),
    });
    setTransferring(false);
    setTransferTarget(null);
    router.refresh();
  }

  async function loadRanking() {
    if (ranking !== null) return;
    setRankingLoading(true);
    const res = await fetch(`/api/ligas/ranking?liga_id=${liga.id}`);
    if (res.ok) setRanking(await res.json());
    setRankingLoading(false);
  }

  useEffect(() => {
    if (expanded && tab === "ranking") loadRanking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, tab]);

  const uninvitedFriends = friends.filter((f) => !invited.has(f.id));

  const tabLabels: Record<Tab, string> = {
    members: "Membros",
    ranking: "Ranking",
    subligas: `Sub-ligas${subLigas.length > 0 ? ` (${subLigas.length})` : ""}`,
  };

  return (
    <>
      {showCreateSub && (
        <CreateLigaModal
          onClose={() => setShowCreateSub(false)}
          parentLigaId={liga.id}
          parentLigaName={liga.name}
        />
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden transition-all">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${liga.color}20`, border: `1.5px solid ${liga.color}40` }}
          >
            <Trophy size={18} style={{ color: liga.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-white truncate">{liga.name}</p>
              {isCreator && <Crown size={11} style={{ color: liga.color }} className="shrink-0" />}
              {liga.is_public ? (
                <Globe size={11} className="text-sim shrink-0" aria-label="Liga pública" />
              ) : (
                <Lock size={11} className="text-muted-foreground shrink-0" aria-label="Liga privada" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Users size={11} />
              <span>{activeMembers.length} membros</span>
              {liga.is_public && <span className="text-sim text-[10px] font-medium">Pública</span>}
              {liga.description && <span className="truncate">· {liga.description}</span>}
            </div>
          </div>
          <ChevronRight
            size={16}
            className={`text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          />
        </button>

        {/* Expanded */}
        {expanded && (
          <div className="border-t border-border">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    tab === t ? "text-white border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {tabLabels[t]}
                </button>
              ))}
            </div>

            <div className="px-4 pb-4 space-y-4">
              {/* ── MEMBERS TAB ── */}
              {tab === "members" && (
                <>
                  <div className="pt-3 space-y-2">
                    {activeMembers.map((member) => {
                      const name = member.profiles?.full_name ?? member.profiles?.username ?? "?";
                      const isMemberCreator = member.user_id === liga.creator_id;
                      return (
                        <div key={member.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback
                                  className="text-xs font-semibold"
                                  style={{ backgroundColor: `${liga.color}40`, color: liga.color }}
                                >
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                              {isMemberCreator && (
                                <div
                                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px]"
                                  style={{ backgroundColor: liga.color, color: "#000" }}
                                >
                                  ★
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium">{name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {isMemberCreator ? "Criador" : "@" + member.profiles?.username}
                              </p>
                            </div>
                          </div>
                          {isCreator && !isMemberCreator && (
                            <button
                              onClick={() => setTransferTarget(transferTarget === member.user_id ? null : member.user_id)}
                              className="text-[10px] text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded"
                            >
                              Transferir admin
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Pendentes */}
                    {liga.members.filter((m) => m.status === "pending").map((m) => (
                      <div key={m.id} className="flex items-center gap-2.5 opacity-50">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {getInitials(m.profiles?.full_name ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm text-muted-foreground">{m.profiles?.full_name}</p>
                          <p className="text-[10px] text-yellow-500">Convite pendente</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Confirmar transferência */}
                  {transferTarget && (
                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                      <p className="text-xs text-yellow-400 flex-1">
                        Transferir liderança para{" "}
                        <strong>{activeMembers.find((m) => m.user_id === transferTarget)?.profiles?.full_name}</strong>?
                      </p>
                      <button
                        onClick={transferAdmin}
                        disabled={transferring}
                        className="text-xs font-medium text-sim hover:text-sim/80 disabled:opacity-50"
                      >
                        {transferring ? <Loader2 size={12} className="animate-spin" /> : "Confirmar"}
                      </button>
                      <button onClick={() => setTransferTarget(null)} className="text-muted-foreground hover:text-white">
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Convidar + Sair — ligas privadas */}
                  {!liga.is_public && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {isMember && (
                        <button
                          onClick={() => setShowInvite(!showInvite)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                          style={{ backgroundColor: `${liga.color}15`, color: liga.color }}
                        >
                          <UserPlus size={13} />
                          Convidar amigo
                        </button>
                      )}
                      {!isCreator && (
                        <button
                          onClick={leaveLeague}
                          disabled={leaving}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                          Sair da liga
                        </button>
                      )}
                    </div>
                  )}

                  {/* Para ligas públicas: só mostrar botão de sair */}
                  {liga.is_public && !isCreator && (
                    <button
                      onClick={leaveLeague}
                      disabled={leaving}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                      Sair da liga
                    </button>
                  )}

                  {/* Painel de convite */}
                  {showInvite && (
                    <div className="space-y-2">
                      {/* Amigos aceitos */}
                      {uninvitedFriends.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Seus amigos</p>
                          {uninvitedFriends.map((friend) => (
                            <div key={friend.id} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                                    {getInitials(friend.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-white">{friend.full_name}</span>
                              </div>
                              <button
                                onClick={() => inviteFriend(friend.id)}
                                disabled={inviting === friend.id || invited.has(friend.id)}
                                className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                                style={{ backgroundColor: `${liga.color}20`, color: liga.color }}
                              >
                                {inviting === friend.id ? <Loader2 size={12} className="animate-spin" /> : invited.has(friend.id) ? <Check size={12} /> : <UserPlus size={12} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Busca por qualquer usuário */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Buscar usuário</p>
                        <div className="relative">
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={searchQ}
                            onChange={(e) => searchUsers(e.target.value)}
                            placeholder="Nome ou @usuário..."
                            className="w-full pl-7 pr-3 py-2 bg-input border border-border rounded-lg text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                          />
                          {searching && <Loader2 size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                        </div>
                        {searchResults.map((u) => (
                          <div key={u.id} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                                  {getInitials(u.full_name ?? u.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs text-white">{u.full_name ?? u.username}</p>
                                <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => inviteFriend(u.id)}
                              disabled={inviting === u.id || invited.has(u.id)}
                              className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                              style={{ backgroundColor: `${liga.color}20`, color: liga.color }}
                            >
                              {inviting === u.id ? <Loader2 size={12} className="animate-spin" /> : invited.has(u.id) ? <Check size={12} /> : <UserPlus size={12} />}
                            </button>
                          </div>
                        ))}
                        {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-1">Nenhum usuário encontrado</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── RANKING TAB ── */}
              {tab === "ranking" && (
                <div className="pt-3">
                  {rankingLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : !ranking || ranking.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum palpite resolvido nesta liga ainda
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ranking.map((entry, i) => (
                        <div key={entry.user_id} className="flex items-center gap-3">
                          <span
                            className={`text-xs font-bold w-5 text-center shrink-0 ${
                              i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-muted-foreground"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback
                              className="text-[10px] font-semibold"
                              style={{ backgroundColor: `${liga.color}30`, color: liga.color }}
                            >
                              {getInitials(entry.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">{entry.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{entry.won}/{entry.total} ganhas</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-xs font-semibold flex items-center gap-0.5 justify-end ${entry.profit >= 0 ? "text-sim" : "text-nao"}`}>
                              {entry.profit >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {formatCurrency(Math.abs(entry.profit))}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{formatCurrency(entry.invested)} invest.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── SUB-LIGAS TAB ── */}
              {tab === "subligas" && (
                <div className="pt-3 space-y-3">
                  {subLigas.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhuma sub-liga ainda</p>
                  ) : (
                    subLigas.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${sub.color}20`, border: `1.5px solid ${sub.color}40` }}
                        >
                          <Trophy size={14} style={{ color: sub.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{sub.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {sub.members.filter((m) => m.status === "active").length} membros
                          </p>
                        </div>
                      </div>
                    ))
                  )}

                  {isCreator && (
                    <button
                      onClick={() => setShowCreateSub(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-white hover:border-border/80 transition-colors"
                    >
                      <Plus size={13} />
                      Nova sub-liga
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
