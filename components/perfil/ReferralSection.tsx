"use client";

import { useState } from "react";
import { Gift, Copy, Check, Users } from "lucide-react";

interface Props {
  referralCode: string;
  totalReferrals: number;
  completedReferrals: number;
  appUrl: string;
}

export default function ReferralSection({ referralCode, totalReferrals, completedReferrals, appUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${appUrl}/r/${referralCode}`;

  function copiar() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Gift size={15} className="text-primary" />
        <h3 className="text-sm font-semibold text-white">Indicar amigos</h3>
        <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
          <Users size={11} />
          {completedReferrals}/{totalReferrals} convertidos
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Compartilhe seu link. Quando o amigo fizer o primeiro depósito, <span className="text-white font-semibold">ambos ganham R$ 5,00</span>.
      </p>

      <div className="flex gap-2">
        <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono truncate">
          {link}
        </div>
        <button
          onClick={copiar}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-black text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors shrink-0"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>

      {completedReferrals > 0 && (
        <p className="text-xs text-sim">
          +R$ {(completedReferrals * 5).toFixed(2)} ganhos com indicações
        </p>
      )}
    </div>
  );
}
