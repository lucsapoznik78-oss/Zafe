"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/liga"), 1500);
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/zafe-logo-full.png" alt="Zafe" className="h-12 mx-auto mb-3" />
        </div>

        {done ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
            <CheckCircle2 size={36} className="mx-auto text-primary" />
            <div>
              <p className="text-lg font-bold text-white">Senha redefinida!</p>
              <p className="text-sm text-muted-foreground mt-1">Redirecionando…</p>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-white">Nova senha</p>
              <p className="text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-muted-foreground">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-border focus:border-primary pr-10"
                    required
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

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm text-muted-foreground">Confirme a nova senha</Label>
                <Input
                  id="confirm"
                  type={showPass ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="bg-input border-border focus:border-primary"
                  required
                />
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full bg-primary text-white font-semibold hover:bg-primary/90"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Redefinir senha"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
