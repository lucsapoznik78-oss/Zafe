"use client";

import { useState } from "react";

import { corDoEsporte } from "@/lib/escalacao/cores";

/**
 * O rosto do atleta no campo.
 *
 * `foto_url` é curadoria progressiva (migration 079) e vai passar muito tempo
 * incompleta — atleta de card secundário não tem foto decente em lugar nenhum.
 * Então o fallback não é um estado de erro, é o estado normal: as iniciais no
 * mesmo círculo, com a cor do esporte. Um pool sem nenhuma foto continua sendo
 * uma escalação legível.
 *
 * `onError` cobre o segundo caso: a URL existe mas o host caiu ou removeu o
 * arquivo. Sem isso o navegador desenha o ícone de imagem quebrada e o campo
 * inteiro fica sujo.
 */

/** "Gabriel Medina" → "GM". Uma inicial só quando o nome é único. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface Props {
  nome: string;
  esporte: string;
  fotoUrl?: string | null;
  tamanho?: "sm" | "md" | "lg";
}

const TAMANHOS = {
  sm: "h-9 w-9 text-[10px]",
  md: "h-12 w-12 text-xs",
  lg: "h-14 w-14 text-sm",
};

export default function FotoAtleta({ nome, esporte, fotoUrl, tamanho = "md" }: Props) {
  const [quebrou, setQuebrou] = useState(false);
  const cor = corDoEsporte(esporte);
  const base = `${TAMANHOS[tamanho]} rounded-full ring-2 shrink-0 overflow-hidden ${cor}`;

  if (fotoUrl && !quebrou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={nome}
        loading="lazy"
        onError={() => setQuebrou(true)}
        className={`${base} object-cover bg-black/40`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${base} bg-gradient-to-b flex items-center justify-center font-bold tracking-tight`}
    >
      {iniciais(nome)}
    </span>
  );
}
