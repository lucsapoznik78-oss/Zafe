"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { formatarCPF } from "@/lib/cpf";

interface Props {
  onSuccess?: () => void;
}

export default function CpfForm({ onSuccess }: Props) {
  const router = useRouter();
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCpf(formatarCPF(e.target.value));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/kyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao verificar CPF");
    } else {
      onSuccess?.();
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <ShieldCheck size={16} className="text-yellow-400 mt-0.5 shrink-0" />
        <p className="text-xs text-yellow-300">
          Para sacar, precisamos verificar seu CPF. Seus dados são protegidos e usados apenas para conformidade regulatória.
        </p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">CPF</label>
        <input
          type="text"
          value={cpf}
          onChange={handleChange}
          placeholder="000.000.000-00"
          maxLength={14}
          inputMode="numeric"
          className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <button
        type="submit"
        disabled={loading || cpf.replace(/\D/g, "").length < 11}
        className="w-full py-2.5 bg-primary text-black font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Verificar CPF"}
      </button>
    </form>
  );
}
