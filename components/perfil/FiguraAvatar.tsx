"use client";

// FiguraAvatar — render puro do avatar-personagem via DiceBear.
//
// Estilo fixo em "avataaars" (Bitmoji-like). O SVG é gerado sob demanda no
// client a partir do JSON salvo em profiles.figura — nada de armazenar bytes.
// Se `figura` for null (usuário ainda não montou o personagem), o componente
// retorna null e quem chama mostra o fallback (iniciais, placeholder, etc).

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";

export type FiguraConfig = {
  seed?: string;
  backgroundColor?: string;
  skinColor?: string;
  top?: string;
  hairColor?: string;
  facialHair?: string;
  facialHairColor?: string;
  clothing?: string;
  clothesColor?: string;
  clothingGraphic?: string;
  accessories?: string;
  accessoriesColor?: string;
  eyebrows?: string;
  eyes?: string;
  mouth?: string;
};

interface Props {
  figura: FiguraConfig | null | undefined;
  size?: number;
  className?: string;
}

// Wrapper único de opções — DiceBear tipa cada campo como string[] mesmo quando
// só vamos passar uma escolha, então converto sempre pra array.
function toOpts(f: FiguraConfig) {
  const o: Record<string, unknown> = { seed: f.seed || "zafe" };
  if (f.backgroundColor)   o.backgroundColor   = [stripHash(f.backgroundColor)];
  if (f.skinColor)         o.skinColor         = [f.skinColor];
  if (f.top)               o.top               = [f.top];
  if (f.hairColor)         o.hairColor         = [stripHash(f.hairColor)];
  if (f.facialHair)        o.facialHair        = [f.facialHair];
  if (f.facialHairColor)   o.facialHairColor   = [stripHash(f.facialHairColor)];
  if (f.clothing)          o.clothing          = [f.clothing];
  if (f.clothesColor)      o.clothesColor      = [stripHash(f.clothesColor)];
  if (f.clothingGraphic)   o.clothingGraphic   = [f.clothingGraphic];
  if (f.accessories)       o.accessories       = [f.accessories];
  if (f.accessoriesColor)  o.accessoriesColor  = [stripHash(f.accessoriesColor)];
  if (f.eyebrows)          o.eyebrows          = [f.eyebrows];
  if (f.eyes)              o.eyes              = [f.eyes];
  if (f.mouth)             o.mouth             = [f.mouth];
  return o;
}

function stripHash(c: string) {
  return c.startsWith("#") ? c.slice(1) : c;
}

export default function FiguraAvatar({ figura, size = 96, className }: Props) {
  const svg = useMemo(() => {
    if (!figura) return null;
    return createAvatar(avataaars, toOpts(figura)).toString();
  }, [figura]);

  if (!svg) return null;

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
