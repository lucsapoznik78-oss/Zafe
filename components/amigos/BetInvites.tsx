"use client";

import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface Invite {
  id: string;
  inviter_side: "sim" | "nao";
  invitee_side: "sim" | "nao";
  amount: number;
  topic: { title: string };
  inviter: { username: string; full_name: string };
}

export default function BetInvites({ invites }: { invites: Invite[] }) {
  const router = useRouter();

  async function respond(inviteId: string, accept: boolean) {
    const endpoint = accept ? "/api/amigos/aceitar-aposta" : "/api/amigos/recusar-aposta";
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_id: inviteId }),
    });
    router.refresh();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        Convites de Palpite
        <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs">{invites.length}</span>
      </h3>
      {invites.map((invite) => (
        <div key={invite.id} className="border border-border rounded-lg p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="text-white font-medium">{invite.inviter.full_name}</span> te convidou para palpitar
          </p>
          <p className="text-sm text-white font-medium line-clamp-2">{invite.topic?.title}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              <span className={`font-bold ${invite.invitee_side === "sim" ? "text-sim" : "text-nao"}`}>
                Seu lado: {invite.invitee_side.toUpperCase()}
              </span>
              <span className="text-muted-foreground">{formatCurrency(invite.amount)} cada</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => respond(invite.id, true)}
                className="p-1.5 bg-sim/20 text-sim rounded-lg hover:bg-sim/30 transition-colors"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => respond(invite.id, false)}
                className="p-1.5 bg-nao/20 text-nao rounded-lg hover:bg-nao/30 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
