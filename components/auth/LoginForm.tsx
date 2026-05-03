"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginForm({ next, theme }: { next?: string; theme?: "concurso" }) {
  const router = useRouter();
  const supabase = createClient();
  const redirectTo = next && next.startsWith("/") ? next : "/liga";
  const isConcurso = theme === "concurso";

  // Cores dinâmicas baseadas no tema
  const btnClass = isConcurso
    ? "w-full bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
    : "w-full bg-primary text-black font-semibold hover:bg-primary/90";
  const tabActiveClass = isConcurso
    ? "bg-yellow-400 text-black"
    : "bg-primary text-black";
  const inputFocusClass = isConcurso
    ? "bg-input border-border focus:border-yellow-400"
    : "bg-input border-border focus:border-primary";
  const successClass = isConcurso ? "text-yellow-400 text-sm" : "text-primary text-sm";
  const cardClass = isConcurso
    ? "bg-yellow-400/5 border border-yellow-400/30 rounded-xl p-6 space-y-5"
    : "bg-card border border-border rounded-xl p-6 space-y-5";

  const [mode, setMode] = useState<"login" | "cadastro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Estado do fluxo 2FA
  const [step, setStep] = useState<"credentials" | "choose-2fa" | "verify-otp">("credentials");
  const [twoFaMethod, setTwoFaMethod] = useState<"email" | "sms">("email");
  const [otp, setOtp] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "login") {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) {
        setError("Email ou senha inválidos.");
        setLoading(false);
        return;
      }

      // Verifica se o usuário tem 2FA ativo
      const { data: profile } = await supabase
        .from("profiles")
        .select("two_fa_enabled, two_fa_method, phone")
        .eq("id", data.user.id)
        .single();

      if (profile?.two_fa_enabled) {
        // Tem 2FA — faz logout temporário e pede verificação
        setPendingUserId(data.user.id);
        setTwoFaMethod(profile.two_fa_method ?? "email");
        await supabase.auth.signOut();
        await sendOtp(profile.two_fa_method ?? "email", data.user.email ?? email, profile.phone ?? "");
        setStep("verify-otp");
      } else {
        router.push(redirectTo);
      }
    } else {
      if (!fullName || !username) {
        setError("Preencha nome completo e nome de usuário.");
        setLoading(false);
        return;
      }
      const phoneClean = phone.replace(/\D/g, "");
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, username },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      // Salva telefone no perfil se fornecido
      if (phoneClean) {
        // O trigger cria o perfil; atualizamos o phone logo após signup
        const { data: { user: newUser } } = await supabase.auth.getUser();
        if (newUser) {
          await supabase.from("profiles").update({ phone: phoneClean }).eq("id", newUser.id);
        }
      }
      setSuccess("Conta criada! Verifique seu email para confirmar.");
    }
    setLoading(false);
  }

  async function sendOtp(method: "email" | "sms", emailAddr: string, phoneNumber: string) {
    if (method === "sms" && phoneNumber) {
      const formatted = phoneNumber.startsWith("+") ? phoneNumber : `+55${phoneNumber}`;
      await supabase.auth.signInWithOtp({ phone: formatted });
    } else {
      await supabase.auth.signInWithOtp({ email: emailAddr });
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    let verifyResult;
    if (twoFaMethod === "sms") {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", pendingUserId ?? "")
        .single();
      const phoneNumber = profileData?.phone ?? "";
      const formatted = phoneNumber.startsWith("+") ? phoneNumber : `+55${phoneNumber}`;
      verifyResult = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: "sms" });
    } else {
      verifyResult = await supabase.auth.verifyOtp({ email, token: otp, type: "magiclink" });
    }

    if (verifyResult.error) {
      setError("Código inválido ou expirado. Tente novamente.");
    } else {
      router.push(redirectTo);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` },
    });
  }

  // ── Tela de verificação OTP ─────────────────────────────────────
  if (step === "verify-otp") {
    return (
      <div className={cardClass}>
        <div className="text-center space-y-1">
          <p className="text-lg font-bold text-white">Verificação em 2 etapas</p>
          <p className="text-sm text-muted-foreground">
            {twoFaMethod === "sms"
              ? "Enviamos um código SMS para o seu celular."
              : `Enviamos um código para ${email}.`}
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Código de verificação</Label>
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="bg-input border-border focus:border-primary text-center text-2xl tracking-widest font-mono"
              required
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button
            type="submit"
            disabled={loading || otp.length < 6}
            className={btnClass}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Verificar código"}
          </Button>
        </form>

        <button
          onClick={() => { setStep("credentials"); setOtp(""); setError(""); }}
          className="w-full text-xs text-muted-foreground hover:text-white transition-colors"
        >
          Voltar ao login
        </button>
      </div>
    );
  }

  // ── Tela principal ───────────────────────────────────────────────
  return (
    <div className={cardClass}>
      <div className="flex border border-border rounded-lg p-1 gap-1">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "login" ? tabActiveClass : "text-muted-foreground hover:text-white"
          }`}
        >
          Entrar
        </button>
        <button
          onClick={() => setMode("cadastro")}
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "cadastro" ? tabActiveClass : "text-muted-foreground hover:text-white"
          }`}
        >
          Cadastrar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "cadastro" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm text-muted-foreground">Nome completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="João Silva"
                className={inputFocusClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm text-muted-foreground">Nome de usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                placeholder="joaosilva"
                className={inputFocusClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm text-muted-foreground">
                Celular <span className="text-muted-foreground/50 font-normal">(opcional — para verificação em 2 etapas)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className={inputFocusClass}
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className={inputFocusClass}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm text-muted-foreground">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputFocusClass} pr-10`}
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

        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && <p className={successClass}>{success}</p>}

        <Button
          type="submit"
          disabled={loading}
          className={btnClass}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
        </div>
      </div>

      <button
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-border rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google
      </button>
    </div>
  );
}
