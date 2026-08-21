"use client";

// ZafeAvatarKit — wrapper do <model-viewer> (web component do Google) para os
// avatares pré-cozidos do kit (capitao/analista/craque/raiz/cyber). Vive em
// paralelo ao EditorPersonagem (que renderiza os `av-*` procedurais em
// three.js); os dois catálogos coexistem sem se enxergar.
//
// - `poster` é o PNG 1024px do 2d/: aparece instantâneo enquanto o .glb baixa.
// - `loading=lazy` garante que a listagem não puxa 5 × ~9MB de uma vez.
// - Script do model-viewer é injetado UMA vez por página (guard em módulo).

import { useEffect } from "react";
import { avatarKitPorId, type AvatarKit } from "@/lib/figura/avatares-kit";

// O <model-viewer> é web component; declaramos pra TSX não reclamar do JSX.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & Record<string, unknown>,
        HTMLElement
      >;
    }
  }
}

let scriptCarregado = false;
function carregarModelViewer() {
  if (scriptCarregado || typeof document === "undefined") return;
  scriptCarregado = true;
  if (document.querySelector("script[data-model-viewer]")) return;
  const s = document.createElement("script");
  s.type = "module";
  s.src = "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
  s.dataset.modelViewer = "1";
  document.head.appendChild(s);
}

type Props = {
  personagem: AvatarKit["id"];
  /** largura em px; altura = width * 1.3 (proporção do render 2d) */
  tamanho?: number;
  girar?: boolean;
  className?: string;
};

export default function ZafeAvatarKit({
  personagem,
  tamanho = 320,
  girar = true,
  className,
}: Props) {
  useEffect(carregarModelViewer, []);
  const a = avatarKitPorId(personagem);
  if (!a) return null;

  return (
    <model-viewer
      src={a.glb}
      poster={a.poster}
      alt={a.nome}
      camera-controls
      {...(girar ? { "auto-rotate": true, "rotation-per-second": "20deg" } : {})}
      loading="lazy"
      reveal="auto"
      shadow-intensity="1"
      exposure="1.1"
      className={className}
      style={{ width: tamanho, height: Math.round(tamanho * 1.3) }}
    />
  );
}
