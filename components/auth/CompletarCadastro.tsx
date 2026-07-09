"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, Mail, Phone, CreditCard, Calendar, Gift } from "lucide-react";
import { formatarCPF, validarCPF } from "@/lib/cpf";
import { formatarTelefone, formatarDataBR, dataBRparaISO } from "@/lib/masks";

interface Props {
  isGoogle: boolean;
  email: string;
  initialFullName: string;
  needsBirthDate: boolean;
  next?: string;
}

const labelClass = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";
const hintClass = "text-[11px] font-bold uppercase tracking-wider";
const inputClass = "bg-input border-border focus:border-primary pl-10 h-11";

function Field({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        {icon}
      </span>
      {children}
    </div>
  );
}

export default function CompletarCadastro({ isGoogle, email, initialFullName, needsBirthDate, next }: Props) {
  const router = useRouter();
  const destino = next && next.startsWith("/") ? next : "/inicio";

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [refCode, setRefCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cpfValido = validarCPF(cpf);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (fullName.trim().length < 3) {
      setError("Informe seu nome completo.");
      return;
    }
    const phoneClean = phone.replace(/\D/g, "");
    if (phoneClean.length < 10) {
      setError("Informe um telefone válido com DDD.");
      return;
    }
    if (!cpfValido) {
      setError("CPF inválido. Confira os números.");
      return;
    }
    let birthISO: string | undefined;
    if (needsBirthDate) {
      const iso = dataBRparaISO(birthDate);
      if (!iso) {
        setError("Data de nascimento inválida — use DD/MM/AAAA.");
        return;
      }
      birthISO = iso;
    }
    if (!acceptedTerms) {
      setError("Você precisa concordar com os Termos de Uso para continuar.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/perfil/completar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        phone: phoneClean,
        cpf: cpf.replace(/\D/g, ""),
        birthDate: birthISO,
        acceptedTerms: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Não foi possível salvar seus dados.");
      setLoading(false);
      return;
    }

    // Código de indicação (opcional) — reusa o endpoint do sistema de referral
    if (refCode.trim()) {
      await fetch("/api/referral/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: refCode.trim().toUpperCase() }),
      }).catch(() => {});
    }

    router.replace(destino);
    router.refresh();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-white">Finalize seu cadastro</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isGoogle
            ? "Sua conta do Google foi conectada. Falta só completar alguns dados pra você começar a prever."
            : "Falta só completar alguns dados pra você começar a prever."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="fullName" className={labelClass}>Nome completo</label>
          <Field icon={<User size={15} />}>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
              className={inputClass}
              required
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>
            E-mail {isGoogle && <span className={`${hintClass} text-primary`}>do Google</span>}
          </label>
          <Field icon={<Mail size={15} />}>
            <Input
              id="email"
              type="email"
              value={email}
              readOnly
              disabled
              className={`${inputClass} opacity-70 cursor-not-allowed`}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className={labelClass}>
            Telefone <span className={`${hintClass} text-muted-foreground/60`}>(com DDD)</span>
          </label>
          <Field icon={<Phone size={15} />}>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatarTelefone(e.target.value))}
              placeholder="(11) 99999-9999"
              maxLength={15}
              className={inputClass}
              required
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cpf" className={labelClass}>CPF</label>
          <Field icon={<CreditCard size={15} />}>
            <Input
              id="cpf"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatarCPF(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              className={inputClass}
              required
            />
          </Field>
          {cpf.replace(/\D/g, "").length === 11 && !cpfValido && (
            <p className="text-destructive text-xs">CPF inválido. Confira os números.</p>
          )}
        </div>

        {needsBirthDate && (
          <div className="space-y-1.5">
            <label htmlFor="birthDate" className={labelClass}>Data de nascimento</label>
            <Field icon={<Calendar size={15} />}>
              <Input
                id="birthDate"
                inputMode="numeric"
                value={birthDate}
                onChange={(e) => setBirthDate(formatarDataBR(e.target.value))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className={inputClass}
                required
              />
            </Field>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="refCode" className={labelClass}>
            Código de indicação <span className={`${hintClass} text-muted-foreground/60`}>(opcional)</span>
          </label>
          <Field icon={<Gift size={15} className="text-pink-400" />}>
            <Input
              id="refCode"
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              placeholder="Digite o código de quem te indicou"
              className={inputClass}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            Ao me cadastrar, concordo com os{" "}
            <Link href="/termos" target="_blank" className="text-primary hover:underline">Termos de Uso</Link>
            {" "}e a{" "}
            <Link href="/termos" target="_blank" className="text-primary hover:underline">Política de Privacidade</Link>.
          </span>
        </label>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-primary text-white font-bold hover:bg-primary/90"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Começar a prever"}
        </Button>
      </form>
    </div>
  );
}
