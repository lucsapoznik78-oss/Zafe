"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";

interface Props {
  desafioId: string;
  proofDeadlineAt: string;
}

export default function DesafioProofForm({ desafioId, proofDeadlineAt }: Props) {
  const [form, setForm] = useState({
    claimed_side: "sim",
    proof_type: "link",
    proof_url: "",
    proof_notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ outcome: string; message: string; motivo: string } | null>(null);
  const [error, setError] = useState("");

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.proof_url.trim()) {
      setError("Informe o link/URL da prova");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/desafios/${desafioId}/submeter-prova`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao enviar prova");
    } else {
      setResult(data);
      setTimeout(() => window.location.reload(), 3000);
    }
  }

  const deadline = new Date(proofDeadlineAt);
  const timeLeft = deadline.getTime() - Date.now();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Upload size={16} className="text-yellow-400" />
        <p className="text-sm font-semibold text-yellow-400">Enviar prova do resultado</p>
      </div>
      <p className="text-xs text-yellow-300/70">
        Prazo: {deadline.toLocaleString("pt-BR")} ({hoursLeft}h restantes)
      </p>

      {result ? (
        <div className={`rounded-lg p-3 text-sm ${
          result.outcome === "approved" ? "bg-sim/10 text-sim border border-sim/30" : "bg-nao/10 text-nao border border-nao/30"
        }`}>
          <p className="font-bold">{result.outcome === "approved" ? "Prova aprovada!" : "Prova rejeitada"}</p>
          <p className="text-xs mt-1">{result.message}</p>
          {result.motivo && <p className="text-xs mt-0.5 opacity-80">IA: {result.motivo}</p>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Resultado declarado */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Resultado</label>
            <div className="grid grid-cols-2 gap-2">
              {(["sim", "nao"] as const).map((s) => (
                <button type="button" key={s} onClick={() => set("claimed_side", s)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                    form.claimed_side === s
                      ? s === "sim" ? "bg-sim/20 border-sim text-sim" : "bg-nao/20 border-nao text-nao"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de prova */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo de prova</label>
            <select
              value={form.proof_type}
              onChange={(e) => set("proof_type", e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="link">Link de notícia / site</option>
              <option value="foto">Foto / print (imgur, etc.)</option>
              <option value="video">Vídeo (YouTube, Drive, etc.)</option>
              <option value="resultado_oficial">Resultado oficial</option>
            </select>
          </div>

          {/* URL */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">URL da prova <span className="text-nao">*</span></label>
            <input
              type="url"
              value={form.proof_url}
              onChange={(e) => set("proof_url", e.target.value)}
              placeholder="https://..."
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500/50"
            />
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notas adicionais (opcional)</label>
            <textarea
              value={form.proof_notes}
              onChange={(e) => set("proof_notes", e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Contexto adicional sobre a prova..."
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500/50 resize-none"
            />
          </div>

          {error && <p className="text-destructive text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-yellow-500 text-black font-bold rounded-lg text-sm hover:bg-yellow-400 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Enviar prova para avaliação"}
          </button>
        </form>
      )}
    </div>
  );
}
