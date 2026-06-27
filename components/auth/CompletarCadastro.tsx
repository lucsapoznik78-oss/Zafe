"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { formatarCPF, validarCPF } from "@/lib/cpf";

interface Props {
  needsBirthDate: boolean;
  needsAddress: boolean;
  next?: string;
}

export default function CompletarCadastro({ needsBirthDate, needsAddress, next }: Props) {
  const router = useRouter();
  const destino = next && next.startsWith("/") ? next : "/inicio";

  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cpfValido = validarCPF(cpf);
  const inputClass = "bg-input border-border focus:border-primary";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!cpfValido) {
      setError("CPF inválido. Confira os números.");
      return;
    }
    if (needsBirthDate && !birthDate) {
      setError("Informe sua data de nascimento.");
      return;
    }
    if (needsAddress) {
      const cepClean = cep.replace(/\D/g, "");
      const ufClean = uf.trim().toUpperCase();
      if (!cepClean || !logradouro.trim() || !numero.trim() || !bairro.trim() || !cidade.trim() || !ufClean) {
        setError("Preencha o endereço completo.");
        return;
      }
      if (cepClean.length !== 8) {
        setError("CEP inválido — use 8 dígitos.");
        return;
      }
      if (ufClean.length !== 2) {
        setError("UF inválida — use a sigla de 2 letras (ex.: SP).");
        return;
      }
    }

    setLoading(true);
    const res = await fetch("/api/perfil/completar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpf: cpf.replace(/\D/g, ""),
        birthDate: needsBirthDate ? birthDate : undefined,
        cep: needsAddress ? cep.replace(/\D/g, "") : undefined,
        logradouro: needsAddress ? logradouro.trim() : undefined,
        numero: needsAddress ? numero.trim() : undefined,
        complemento: needsAddress ? complemento.trim() : undefined,
        bairro: needsAddress ? bairro.trim() : undefined,
        cidade: needsAddress ? cidade.trim() : undefined,
        uf: needsAddress ? uf.trim().toUpperCase() : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error ?? "Não foi possível salvar seus dados.");
      setLoading(false);
      return;
    }

    router.replace(destino);
    router.refresh();
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2.5">
        <ShieldCheck size={15} className="text-primary shrink-0 mt-0.5" />
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Para sua conta ficar completa e poder concorrer a prêmios em R$, precisamos do seu
          <span className="font-semibold text-white"> CPF</span>
          {needsBirthDate || needsAddress ? " e dos dados abaixo" : ""}. Coletamos uma única vez.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cpf" className="text-sm text-muted-foreground">CPF</Label>
          <Input
            id="cpf"
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatarCPF(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            className={inputClass}
            required
            autoFocus
          />
          {cpf.replace(/\D/g, "").length === 11 && !cpfValido && (
            <p className="text-destructive text-xs">CPF inválido. Confira os números.</p>
          )}
        </div>

        {needsBirthDate && (
          <div className="space-y-1.5">
            <Label htmlFor="birthDate" className="text-sm text-muted-foreground">Data de nascimento</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className={inputClass}
              required
            />
          </div>
        )}

        {needsAddress && (
          <>
            <div className="pt-1">
              <p className="text-xs font-medium text-muted-foreground">Endereço</p>
              <p className="text-[10px] text-muted-foreground/60">Exigido para conformidade (prevenção à lavagem de dinheiro).</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="cep" className="text-sm text-muted-foreground">CEP</Label>
                <Input id="cep" inputMode="numeric" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" className={inputClass} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="logradouro" className="text-sm text-muted-foreground">Logradouro</Label>
                <Input id="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder="Rua / Avenida" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="numero" className="text-sm text-muted-foreground">Número</Label>
                <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" className={inputClass} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="complemento" className="text-sm text-muted-foreground">
                  Complemento <span className="text-muted-foreground/50 font-normal">(opcional)</span>
                </Label>
                <Input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto 45" className={inputClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bairro" className="text-sm text-muted-foreground">Bairro</Label>
              <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Centro" className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="cidade" className="text-sm text-muted-foreground">Cidade</Label>
                <Input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="São Paulo" className={inputClass} />
              </div>
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="uf" className="text-sm text-muted-foreground">UF</Label>
                <Input id="uf" value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="SP" maxLength={2} className={inputClass} />
              </div>
            </div>
          </>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" disabled={loading || !cpf} className="w-full bg-primary text-black font-semibold hover:bg-primary/90">
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Concluir cadastro"}
        </Button>
      </form>
    </div>
  );
}
