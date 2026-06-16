"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatarCPF, validarCPF } from "@/lib/cpf";

function calcularIdade(isoDate: string): number {
  const nascimento = new Date(isoDate);
  if (Number.isNaN(nascimento.getTime())) return 0;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

interface Props {
  titulo: string;
  saldoInicial: number;
  initialFullName?: string;
  initialUsername?: string;
}

export default function ConfirmarInscricao({ titulo, saldoInicial, initialFullName = "", initialUsername = "" }: Props) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initialFullName);
  const [username, setUsername] = useState(initialUsername);
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const cpfValido = validarCPF(cpf);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (fullName.trim().length < 3) {
      setError("Informe seu nome completo.");
      return;
    }
    if (!/^[a-z0-9_.]{3,20}$/.test(username.trim().toLowerCase())) {
      setError("Username inválido (3-20 caracteres: letras, números, _ ou .).");
      return;
    }
    if (!cpfValido) {
      setError("CPF inválido.");
      return;
    }
    if (!birthDate) {
      setError("Informe sua data de nascimento.");
      return;
    }
    if (calcularIdade(birthDate) < 18) {
      setError("O concurso é exclusivo para maiores de 18 anos.");
      return;
    }

    setLoading(true);

    // A sessão já autentica o usuário (Google ou email/senha); o servidor revalida
    // em /api/concurso/inscrever. Não re-pedimos senha — isso travava quem entrou
    // com Google (sem senha) e adicionava fricção desnecessária.
    const res = await fetch("/api/concurso/inscrever", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        cpf: cpf.replace(/\D/g, ""),
        birthDate,
      }),
    });
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
          Como o prêmio é pago em R$, confirme seus dados abaixo para entrar.
        </p>
      </div>

      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="confirm-fullname" className="text-sm text-muted-foreground">
            Nome completo
          </Label>
          <Input
            id="confirm-fullname"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Seu nome completo"
            className="bg-input border-border focus:border-yellow-400"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-username" className="text-sm text-muted-foreground">
            Username
          </Label>
          <Input
            id="confirm-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="seu_usuario"
            className="bg-input border-border focus:border-yellow-400"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-cpf" className="text-sm text-muted-foreground">
            CPF
          </Label>
          <Input
            id="confirm-cpf"
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatarCPF(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            className="bg-input border-border focus:border-yellow-400"
            required
          />
          {cpf.replace(/\D/g, "").length === 11 && !cpfValido && (
            <p className="text-destructive text-xs">CPF inválido. Confira os números.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-birthdate" className="text-sm text-muted-foreground">
            Data de nascimento <span className="text-muted-foreground/50 font-normal">(o concurso é 18+)</span>
          </Label>
          <Input
            id="confirm-birthdate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="bg-input border-border focus:border-yellow-400"
            required
          />
          {birthDate && calcularIdade(birthDate) < 18 && (
            <p className="text-destructive text-xs">O concurso é exclusivo para maiores de 18 anos.</p>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          type="submit"
          disabled={loading || !fullName || !username || !cpf || !birthDate}
          className="w-full bg-yellow-400 text-black font-semibold hover:bg-yellow-300"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Confirmar participação"}
        </Button>
      </form>
    </div>
  );
}
