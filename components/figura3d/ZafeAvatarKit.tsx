"use client";

// ZafeAvatarKit — wrapper do <model-viewer> (web component do Google) para os
// avatares pré-cozidos do kit (capitao/analista/craque/raiz/cyber). Vive em
// paralelo ao EditorPersonagem (que renderiza os `av-*` procedurais em
// three.js); os dois catálogos coexistem sem se enxergar.
//
// - `poster` é o PNG 1024px do 2d/: aparece instantâneo enquanto o .glb baixa.
// - `loading=lazy` garante que a listagem não puxa 5 × ~9MB de uma vez.
// - Import LOCAL do @google/model-viewer (via next/dynamic com ssr:false) em
//   vez de <script src=unpkg…>. Assim o CSP de produção — script-src 'self'
//   + va.vercel-scripts.com — não precisa liberar terceiro nenhum.

import dynamic from "next/dynamic";
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

// O pacote só registra o custom element no `customElements` do browser — não
// exporta componente React. Basta importar uma vez no cliente e usar a tag.
// ssr:false porque `window` é obrigatório na registração.
const ModelViewerRegistrar = dynamic(
  () =>
    import("@google/model-viewer").then(() => {
      const Noop = () => null;
      Noop.displayName = "ModelViewerRegistrar";
      return Noop;
    }),
  { ssr: false },
);

type Props = {
  personagem: AvatarKit["id"];
  /** largura em px; altura = width * 1.3 (proporção do render 2d).
   *  Ignorado quando `preencher` é true. */
  tamanho?: number;
  /** Ocupa 100% do container (o pai controla altura/largura). Usa isso
   *  quando o palco tem tamanho dinâmico. */
  preencher?: boolean;
  girar?: boolean;
  className?: string;
};

export default function ZafeAvatarKit({
  personagem,
  tamanho = 320,
  preencher = false,
  girar = true,
  className,
}: Props) {
  const a = avatarKitPorId(personagem);
  if (!a) return null;

  const style = preencher
    ? { width: "100%", height: "100%" }
    : { width: tamanho, height: Math.round(tamanho * 1.3) };

  return (
    <>
      <ModelViewerRegistrar />
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
        style={style}
      />
    </>
  );
}
