"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  email: string;
  titulo: string;
  saldoInicial: number;
}

export default function ConfirmarInscricao({ email, titulo, saldoInicial }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Re-autenticação: confirma a senha da conta logada antes de inscrever
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Senha incorreta. Confirme sua senha para participar.");
      setLoading(false);
      return;
    }

    // Inscrição
    const res = await fetch("/api/concurso/inscrever", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "Não foi possível confirmar sua participação.");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    router.refresh();
    setTimeout(() => router.push("/concurso"), 1200);
  }

  if (done) {
    return (
      <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-6 text-center space-y-3">
        <CheckCircle2 size={36} className="mx-auto text-yellow-400" />
        <div>
          <p className="text-lg font-bold text-yellow-400">Você está participando!</p>
          <p className="text-sm text-yellow-300/70 mt-1">
            Recebeu ZC$ {saldoInicial.toLocaleString("pt-BR")} para competir. Redirecionando…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-yellow-400/20 flex items-center justify-center shrink-0">
          <Trophy size={18} className="text-yellow-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-yellow-300">{titulo}</p>
          <p className="text-[11px] text-yellow-400/60">
            Inscrição grátis · ZC$ {saldoInicial.toLocaleString("pt-BR")} de presente
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20 px-3 py-2.5">
        <AlertCircle size={15} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-[12px] text-yellow-300/80 leading-relaxed">
          Você ainda <span className="font-bold text-yellow-400">não está participando</span> deste concurso.
          Confirme sua senha abaixo para entrar.
        </p>
      </div>

      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">
            Confirme sua senha
          </Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-input border-border focus:border-yellow-400 pr-10"
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Confirmar participação"}
        </Button>
      </form>
    </div>
  );
}
