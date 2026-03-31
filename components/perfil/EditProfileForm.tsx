"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Check, X } from "lucide-react";

interface EditProfileFormProps {
  fullName: string;
  username: string;
}

export default function EditProfileForm({ fullName, username }: EditProfileFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fullName);
  const [user, setUser] = useState(username);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/perfil/atualizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name, username: user }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
    } else {
      setEditing(false);
      router.refresh();
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-1"
      >
        <Pencil size={11} />
        Editar perfil
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 w-full max-w-xs">
      <div>
        <label className="text-xs text-muted-foreground">Nome completo</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50 mt-1"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Username</label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          className="w-full bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50 mt-1"
        />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-black text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Salvar
        </button>
        <button
          onClick={() => { setEditing(false); setName(fullName); setUser(username); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground text-xs rounded-lg hover:text-white"
        >
          <X size={12} />
          Cancelar
        </button>
      </div>
    </div>
  );
}
