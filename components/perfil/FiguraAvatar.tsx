// FiguraAvatar — o personagem em qualquer lugar do app que não seja o editor.
//
// É um `<img>`. O 3D roda UMA vez, na página do editor, e o navegador salva o
// resultado como PNG no Storage. Aqui não há three, não há WebGL e não há
// geração de SVG: a navbar aparece em toda rota do app, e qualquer coisa mais
// pesada que uma tag de imagem sairia caro em toda navegação.
//
// (Antes isto era DiceBear, que gerava o SVG no cliente a cada render e fixava
// dois pacotes no bundle de todas essas rotas.)
//
// Sem URL salva, cai nas iniciais. É o estado de quem ainda não desbloqueou o
// personagem — e a lacuna é de propósito: é ela que dá vontade de ir montar um.

"use client";

import { cn } from "@/lib/utils";

type Props = {
  url: string | null | undefined;
  nome?: string | null;
  size?: number;
  className?: string;
};

function iniciais(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "?";
  const partes = limpo.split(/\s+/);
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default function FiguraAvatar({ url, nome, size = 96, className }: Props) {
  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted font-bold text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      >
        {iniciais(nome)}
      </div>
    );
  }

  return (
    // `<img>` e não `next/image`: a URL traz `?v=<timestamp>` e muda a cada
    // save, então o otimizador da Vercel geraria uma variante nova por save e
    // por tamanho — custo por imagem, sem ganho, num PNG que já é pequeno.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={nome ? `Personagem de ${nome}` : "Personagem"}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
