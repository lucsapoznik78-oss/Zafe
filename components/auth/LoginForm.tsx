"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { TERMS_VERSION } from "@/lib/terms";

// Rate-limit client-side de login: após várias tentativas falhas, impõe um
// cooldown crescente. Não substitui proteção server-side, mas freia força-bruta
// trivial direto do browser (o endpoint do Supabase tem o seu próprio limite).
const LOCK_KEY = "zafe_login_attempts";
const MAX_ATTEMPTS = 5;

function lerTentativas(): { count: number; lockUntil: number } {
  if (typeof localStorage === "undefined") return { count: 0, lockUntil: 0 };
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) ?? "") ?? { count: 0, lockUntil: 0 };
  } catch {
    return { count: 0, lockUntil: 0 };
  }
}

function registrarFalha() {
  const atual = lerTentativas();
  const count = atual.count + 1;
  // Cooldown cresce: 5 falhas → 30s, depois dobra a cada falha (máx. 15min).
  const lockUntil =
    count >= MAX_ATTEMPTS
      ? Date.now() + Math.min(30_000 * 2 ** (count - MAX_ATTEMPTS), 900_000)
      : 0;
  localStorage.setItem(LOCK_KEY, JSON.stringify({ count, lockUntil }));
}

function limparTentativas() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(LOCK_KEY);
}

export default function LoginForm({ next, theme }: { next?: string; theme?: "concurso" }) {
  const router = useRouter();
  const supabase = createClient();
  const redirectTo = next && next.startsWith("/") ? next : "/inicio";
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
  const [birthDate, setBirthDate] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Estado do fluxo de recuperação de senha
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Reenvio do email de confirmação (signup não confirmado)
  const [showResend, setShowResend] = useState(false);

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
      const { lockUntil } = lerTentativas();
      if (lockUntil > Date.now()) {
        const segundos = Math.ceil((lockUntil - Date.now()) / 1000);
        setError(`Muitas tentativas. Tente novamente em ${segundos}s.`);
        setLoading(false);
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) {
        const naoConfirmado =
          (signInError as any)?.code === "email_not_confirmed" ||
          signInError?.message?.toLowerCase().includes("not confirmed");
        if (naoConfirmado) {
          // Senha certa, mas o email nunca foi confirmado — não é "senha inválida"
          setError("Seu email ainda não foi confirmado. Procure o link na caixa de entrada (e no spam) ou reenvie abaixo.");
          setShowResend(true);
        } else {
          registrarFalha();
          setError("Email ou senha inválidos.");
        }
        setLoading(false);
        return;
      }
      limparTentativas();
      setShowResend(false);

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
      const cepClean = cep.replace(/\D/g, "");
      const ufClean = uf.trim().toUpperCase();
      if (!birthDate || !cepClean || !logradouro.trim() || !numero.trim() || !bairro.trim() || !cidade.trim() || !ufClean) {
        setError("Preencha data de nascimento e endereço completo.");
        setLoading(false);
        return;
      }
      if (cepClean.length !== 8) {
        setError("CEP inválido — use 8 dígitos.");
        setLoading(false);
        return;
      }
      if (ufClean.length !== 2) {
        setError("UF inválida — use a sigla de 2 letras (ex.: SP).");
        setLoading(false);
        return;
      }
      if (!acceptedTerms) {
        setError("Você precisa aceitar os Termos de Uso para criar a conta.");
        setLoading(false);
        return;
      }
      const phoneClean = phone.replace(/\D/g, "");
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username,
            birth_date: birthDate,
            cep: cepClean,
            logradouro: logradouro.trim(),
            numero: numero.trim(),
            complemento: complemento.trim(),
            bairro: bairro.trim(),
            cidade: cidade.trim(),
            uf: ufClean,
            terms_version: TERMS_VERSION,
          },
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
      setSuccess("Conta criada! Enviamos um link de confirmação para seu email — confira também a caixa de spam.");
    }
    setLoading(false);
  }

  async function handleResendConfirmation() {
    setLoading(true);
    setError("");
    setSuccess("");
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    if (resendError) {
      setError("Não foi possível reenviar agora. Aguarde alguns minutos e tente de novo.");
    } else {
      setSuccess("Email de confirmação reenviado! Confira sua caixa de entrada e o spam.");
      setShowResend(false);
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
      verifyResult = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    }

    if (verifyResult.error) {
      setError("Código inválido ou expirado. Tente novamente.");
    } else {
      router.push(redirectTo);
    }
    setLoading(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!email) {
      setError("Informe seu email para recuperar a senha.");
      setLoading(false);
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/redefinir-senha`,
    });
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` },
    });
  }

  // ── Tela de recuperação de senha ────────────────────────────────
  if (showReset) {
    return (
      <div className={cardClass}>
        <div className="text-center space-y-1">
          <p className="text-lg font-bold text-white">Recuperar senha</p>
          <p className="text-sm text-muted-foreground">
            {resetSent
              ? `Se houver uma conta com ${email}, enviamos um link para redefinir a senha.`
              : "Informe seu email e enviaremos um link para redefinir sua senha."}
          </p>
        </div>

        {!resetSent && (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email" className="text-sm text-muted-foreground">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className={inputFocusClass}
                required
              />
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button type="submit" disabled={loading} className={btnClass}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Enviar link"}
            </Button>
          </form>
        )}

        <button
          onClick={() => { setShowReset(false); setResetSent(false); setError(""); }}
          className="w-full text-xs text-muted-foreground hover:text-white transition-colors"
        >
          Voltar ao login
        </button>
      </div>
    );
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

  // Botão do Google reutilizado: no tema concurso ele vai pro topo como opção
  // primária ("o novo"); no login normal continua embaixo como alternativa.
  const googleButton = (
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
      {isConcurso ? "Entrar com Google" : "Google"}
    </button>
  );

  // ── Tela principal ───────────────────────────────────────────────
  return (
    <div className={cardClass}>
      {isConcurso && (
        <>
          {googleButton}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">ou com email e senha</span>
            </div>
          </div>
        </>
      )}

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
            <div className="space-y-1.5">
              <Label htmlFor="birthDate" className="text-sm text-muted-foreground">Data de nascimento</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={inputFocusClass}
              />
            </div>
            <div className="pt-1">
              <p className="text-xs font-medium text-muted-foreground">Endereço</p>
              <p className="text-[10px] text-muted-foreground/60">Exigido para conformidade (prevenção à lavagem de dinheiro).</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="cep" className="text-sm text-muted-foreground">CEP</Label>
                <Input
                  id="cep"
                  inputMode="numeric"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  placeholder="00000-000"
                  className={inputFocusClass}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="logradouro" className="text-sm text-muted-foreground">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Rua / Avenida"
                  className={inputFocusClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="numero" className="text-sm text-muted-foreground">Número</Label>
                <Input
                  id="numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="123"
                  className={inputFocusClass}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="complemento" className="text-sm text-muted-foreground">
                  Complemento <span className="text-muted-foreground/50 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="complemento"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Apto 45"
                  className={inputFocusClass}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bairro" className="text-sm text-muted-foreground">Bairro</Label>
              <Input
                id="bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Centro"
                className={inputFocusClass}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="cidade" className="text-sm text-muted-foreground">Cidade</Label>
                <Input
                  id="cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="São Paulo"
                  className={inputFocusClass}
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="uf" className="text-sm text-muted-foreground">UF</Label>
                <Input
                  id="uf"
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                  className={inputFocusClass}
                />
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-violet-500"
              />
              <span>
                Tenho 18 anos ou mais e li e aceito os{" "}
                <Link href="/termos" target="_blank" className="text-violet-300 hover:underline">
                  Termos de Uso
                </Link>
                .
              </span>
            </label>
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

        {showResend && (
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={loading}
            className="w-full py-2 px-4 border border-border rounded-lg text-sm font-medium text-white hover:bg-white/5 transition-colors"
          >
            Reenviar email de confirmação
          </button>
        )}

        <Button
          type="submit"
          disabled={loading}
          className={btnClass}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>

        {mode === "login" && (
          <button
            type="button"
            onClick={() => { setShowReset(true); setError(""); }}
            className="w-full text-xs text-muted-foreground hover:text-white transition-colors"
          >
            Esqueci minha senha
          </button>
        )}
      </form>

      {!isConcurso && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
            </div>
          </div>
          {googleButton}
        </>
      )}
    </div>
  );
}
