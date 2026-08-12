"use client";

// FiguraSection — coluna do personagem que fica ao LADO do NivelSection
// (bronze/prata/ouro…) no /perfil. Se o usuário já montou o personagem,
// mostra o avatar grande + botão "Editar personagem". Se não, mostra CTA
// "Criar seu personagem" que abre o mesmo modal.

import { useState } from "react";
import FiguraAvatar, { type FiguraConfig } from "./FiguraAvatar";
import FiguraBuilder from "./FiguraBuilder";
import { Sparkles, Pencil } from "lucide-react";

export default function FiguraSection({ figura }: { figura: FiguraConfig | null }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3">
      {figura ? (
        <>
          <div className="bg-gradient-to-br from-primary/15 to-black/40 rounded-2xl p-2">
            <FiguraAvatar figura={figura} size={140} />
          </div>
          <button
            onClick={() => setAberto(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Pencil size={12} /> Editar personagem
          </button>
        </>
      ) : (
        <>
          <div className="bg-black/30 border border-dashed border-border rounded-2xl w-[140px] h-[140px] flex items-center justify-center">
            <Sparkles size={28} className="text-muted-foreground/50" />
          </div>
          <button
            onClick={() => setAberto(true)}
            className="text-xs font-bold px-3 py-1.5 bg-primary text-black rounded-lg hover:brightness-110"
          >
            Criar seu personagem
          </button>
          <p className="text-[10px] text-muted-foreground text-center leading-tight">
            Escolha rosto, cabelo, roupa e mais.
          </p>
        </>
      )}

      {aberto && <FiguraBuilder figuraInicial={figura} onClose={() => setAberto(false)} />}
    </div>
  );
}
