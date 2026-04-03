"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, X, Swords, Users, UserMinus, ShieldOff } from "lucide-react";
import PrivateBetModal from "./PrivateBetModal";

interface FriendData {
  id: string;
  status: string;
  requester?: { id: string; username: string; full_name: string };
  addressee?: { id: string; username: string; full_name: string };
}

interface Props {
  sent: FriendData[];
  received: FriendData[];
  currentUserId: string;
}

export default function FriendsList({ sent, received, currentUserId }: Props) {
  const router = useRouter();
  const [betTarget, setBetTarget] = useState<{ id: string; name: string } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [confirmBlockId, setConfirmBlockId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const accepted = [
    ...sent.filter((f) => f.status === "accepted").map((f) => ({ ...f.addressee!, friendshipId: f.id })),
    ...received.filter((f) => f.status === "accepted").map((f) => ({ ...f.requester!, friendshipId: f.id })),
  ];

  const pendingReceived = received.filter((f) => f.status === "pending");

  async function acceptFriend(friendshipId: string) {
    setLoadingId(friendshipId);
    await fetch("/api/amigos/aceitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendship_id: friendshipId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function rejectFriendRequest(friendshipId: string) {
    setLoadingId(friendshipId);
    await fetch("/api/amigos/recusar-solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendship_id: friendshipId }),
    });
    setLoadingId(null);
    router.refresh();
  }

  async function removeFriend(friendshipId: string) {
    setRemovingId(friendshipId);
    setConfirmRemoveId(null);
    await fetch("/api/amigos/remover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendship_id: friendshipId }),
    });
    setRemovingId(null);
    router.refresh();
  }

  async function blockUser(blockedId: string) {
    setBlockingId(blockedId);
    setConfirmBlockId(null);
    await fetch("/api/amigos/bloquear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked_id: blockedId }),
    });
    setBlockingId(null);
    router.refresh();
  }

  function getInitials(name: string) {
    return name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  }

  return (
    <>
      {betTarget && (
        <PrivateBetModal
          friendId={betTarget.id}
          friendName={betTarget.name}
          onClose={() => setBetTarget(null)}
        />
      )}

      {pendingReceived.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            Pedidos de amizade
            <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs">{pendingReceived.length}</span>
          </h3>
          {pendingReceived.map((f) => {
            const person = f.requester!;
            return (
              <div key={f.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">{getInitials(person.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{person.full_name}</p>
                    <p className="text-xs text-muted-foreground">@{person.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptFriend(f.id)}
                    disabled={loadingId === f.id}
                    className="p-1.5 bg-sim/20 text-sim rounded-lg hover:bg-sim/30 transition-colors disabled:opacity-50"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => rejectFriendRequest(f.id)}
                    disabled={loadingId === f.id}
                    className="p-1.5 bg-nao/20 text-nao rounded-lg hover:bg-nao/30 transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Users size={16} />
          Amigos ({accepted.length})
        </h3>
        {accepted.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">Nenhum amigo adicionado ainda</p>
        ) : (
          <div className="space-y-2">
            {accepted.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">{getInitials(friend.full_name)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{friend.full_name}</p>
                    <p className="text-xs text-muted-foreground">@{friend.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {confirmRemoveId === friend.friendshipId ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Remover?</span>
                      <button
                        onClick={() => removeFriend(friend.friendshipId)}
                        disabled={removingId === friend.friendshipId}
                        className="px-2 py-1 text-xs bg-nao/20 text-nao rounded-lg hover:bg-nao/30 transition-colors disabled:opacity-50"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        className="px-2 py-1 text-xs bg-muted/30 text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        Não
                      </button>
                    </div>
                  ) : confirmBlockId === friend.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Bloquear?</span>
                      <button
                        onClick={() => blockUser(friend.id)}
                        disabled={blockingId === friend.id}
                        className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmBlockId(null)}
                        className="px-2 py-1 text-xs bg-muted/30 text-muted-foreground rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setBetTarget({ id: friend.id, name: friend.full_name })}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        <Swords size={12} />
                        Investir
                      </button>
                      <button
                        onClick={() => { setConfirmRemoveId(friend.friendshipId); setConfirmBlockId(null); }}
                        title="Desfazer amizade"
                        className="p-1.5 text-muted-foreground rounded-lg hover:text-nao hover:bg-nao/10 transition-colors"
                      >
                        <UserMinus size={14} />
                      </button>
                      <button
                        onClick={() => { setConfirmBlockId(friend.id); setConfirmRemoveId(null); }}
                        title="Bloquear usuário"
                        className="p-1.5 text-muted-foreground rounded-lg hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <ShieldOff size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
