"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, ImagePlus, X } from "lucide-react";

interface Props {
  desafioId: string;
  proofDeadlineAt: string;
}

export default function DesafioProofForm({ desafioId, proofDeadlineAt }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    claimed_side: "sim",
    proof_type: "link",
    proof_url: "",
    proof_notes: "",
  });
  const [rawImageBase64, setRawImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState(false); // false = URL, true = file upload
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ outcome: string; message: string; motivo: string } | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleProofTypeChange(value: string) {
    set("proof_type", value);
    // Reset upload state when switching away from foto
    if (value !== "foto") {
      setUploadMode(false);
      setRawImageBase64(null);
      setImagePreview(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Imagem muito grande. Máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setRawImageBase64(dataUrl);
      setImagePreview(dataUrl);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setRawImageBase64(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const isFotoUpload = form.proof_type === "foto" && uploadMode;

    if (!isFotoUpload && !form.proof_url.trim()) {
      setError("Informe o link/URL da prova");
      return;
    }
    if (isFotoUpload && !rawImageBase64) {
      setError("Selecione uma imagem para enviar");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/desafios/${desafioId}/submeter-prova`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claimed_side: form.claimed_side,
        proof_type: form.proof_type,
        proof_url: isFotoUpload ? "" : form.proof_url,
        proof_notes: form.proof_notes,
        ...(isFotoUpload && rawImageBase64 ? { raw_image_base64: rawImageBase64 } : {}),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao enviar prova");
    } else {
      setResult(data);
      setTimeout(() => router.refresh(), 3000);
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
              onChange={(e) => handleProofTypeChange(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="link">Link de notícia / site</option>
              <option value="foto">Foto / print</option>
              <option value="video">Vídeo (YouTube, Drive, etc.)</option>
              <option value="resultado_oficial">Resultado oficial</option>
            </select>
          </div>

          {/* Foto: toggle URL vs upload */}
          {form.proof_type === "foto" && (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => { setUploadMode(false); clearImage(); }}
                className={`flex-1 py-1.5 transition-colors ${!uploadMode ? "bg-yellow-500/20 text-yellow-400 font-semibold" : "text-muted-foreground hover:text-white"}`}
              >
                URL (Imgur, Drive…)
              </button>
              <button
                type="button"
                onClick={() => { setUploadMode(true); set("proof_url", ""); }}
                className={`flex-1 py-1.5 transition-colors ${uploadMode ? "bg-yellow-500/20 text-yellow-400 font-semibold" : "text-muted-foreground hover:text-white"}`}
              >
                Upload direto
              </button>
            </div>
          )}

          {/* URL field */}
          {!(form.proof_type === "foto" && uploadMode) && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                URL da prova <span className="text-nao">*</span>
              </label>
              <input
                type="url"
                value={form.proof_url}
                onChange={(e) => set("proof_url", e.target.value)}
                placeholder="https://..."
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500/50"
              />
            </div>
          )}

          {/* Direct upload field */}
          {form.proof_type === "foto" && uploadMode && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Imagem <span className="text-nao">*</span>
              </label>
              {imagePreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-48 object-contain rounded-lg border border-border bg-black/30"
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-black/80"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-6 border border-dashed border-yellow-500/40 rounded-lg text-yellow-400/70 hover:border-yellow-500/70 hover:text-yellow-400 transition-colors"
                >
                  <ImagePlus size={22} />
                  <span className="text-xs">Clique para selecionar imagem</span>
                  <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP — máx. 5MB</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

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
