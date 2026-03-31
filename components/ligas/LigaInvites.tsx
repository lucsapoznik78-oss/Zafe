"use client";

import { useRouter } from "next/navigation";
import { Trophy, Check, X } from "lucide-react";

export default function LigaInvites({ invites }: { invites: any[] }) {
  const router = useRouter();

  async function respond(memberId: string, accept: boolean) {
    await fetch("/api/ligas/aceitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liga_member_id: memberId, accept }),
    });
    router.refresh();
  }

  if (!invites.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        Convites de Liga
        <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs">{invites.length}</span>
      </h3>
      {invites.map((invite) => {
        const liga = Array.isArray(invite.ligas) ? invite.ligas[0] : invite.ligas;
        const inviter = Array.isArray(invite.invited_by_profile) ? invite.invited_by_profile[0] : invite.invited_by_profile;
        return (
        <div key={invite.id} className="border border-border rounded-lg p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${liga?.color}20` }}
            >
              <Trophy size={16} style={{ color: liga?.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{liga?.name}</p>
              <p className="text-xs text-muted-foreground">
                Convidado por <span className="text-white">{inviter?.full_name}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
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
        );
      })}
    </div>
  );
}
