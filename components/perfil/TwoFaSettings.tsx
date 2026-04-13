"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, ShieldCheck, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  enabled: boolean;
  method: "email" | "sms";
  phone: string | null;
}

export default function TwoFaSettings({ enabled: initialEnabled, method: initialMethod, phone: initialPhone }: Props) {
  const supabase = createClient();

  const [enabled, setEnabled] = useState(initialEnabled);
  const [method, setMethod] = useState<"email" | "sms">(initialMethod ?? "email");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setLoading(true);
    setError("");
    setSuccess("");

    if (enabled && method === "sms" && !phone.replace(/\D/g, "")) {
      setError("Informe um número de celular para usar SMS.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Não autenticado."); setLoading(false); return; }

    const { error: err } = await supabase
      .from("profiles")
      .update({
        two_fa_enabled: enabled,
        two_fa_method: enabled ? method : null,
        phone: phone.replace(/\D/g, "") || null,
      })
      .eq("id", user.id);

    if (err) {
      setError("Erro ao salvar. Tente novamente.");
    } else {
      setSuccess("Configurações de segurança salvas.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled
            ? <ShieldCheck size={15} className="text-sim" />
            : <Shield size={15} className="text-muted-foreground" />
          }
          <span className="text-sm font-medium text-white">Verificação em 2 etapas</span>
          {enabled && (
            <span className="px-1.5 py-0.5 bg-sim/20 text-sim text-[10px] rounded font-bold">Ativa</span>
          )}
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-10 h-5 rounded-full transition-colors relative ${enabled ? "bg-primary" : "bg-muted"}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 pl-5 border-l border-border/50">
          <p className="text-xs text-muted-foreground">
            Toda vez que você fizer login, pediremos um código de verificação.
          </p>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Método</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setMethod("email")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  method === "email" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-white"
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setMethod("sms")}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  method === "sms" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-white"
                }`}
              >
                SMS
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="2fa-phone" className="text-xs text-muted-foreground">
              Celular {method === "sms" && <span className="text-nao">*</span>}
            </Label>
            <Input
              id="2fa-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="bg-input border-border focus:border-primary text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              {method === "sms" ? "Obrigatório para SMS." : "Opcional — necessário se mudar para SMS depois."}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
      {success && <p className="text-primary text-xs">{success}</p>}

      <button
        onClick={save}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-black text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : "Salvar segurança"}
      </button>
    </div>
  );
}
