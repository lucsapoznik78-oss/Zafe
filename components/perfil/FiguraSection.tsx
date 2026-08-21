// FiguraSection — a coluna do personagem no /perfil, ao lado do NivelSection.
//
// Virou um link. O editor era um modal quando o personagem era só um rosto 2D;
// agora tem canvas 3D, duas abas e uma loja de 60 itens, e isso é uma página
// (`/perfil/personagem`), não uma caixa por cima do perfil. Sem estado, então
// nem precisa ser client component.

import Link from "next/link";
import { Pencil, Sparkles } from "lucide-react";

export default function FiguraSection({
  url,
  nome,
  desbloqueada,
}: {
  url: string | null;
  nome: string | null;
  desbloqueada: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4">
      {url ? (
        <>
          {/* Container 2:3 (mesma proporção do PNG de corpo inteiro, 512x768):
              o personagem ocupa todo o quadro sem sobra lateral. Bem maior que o
              retrato antigo de 140px — o boneco 3D é uma peça de identidade e no
              perfil é o principal ativo visual. */}
          <div className="rounded-2xl bg-background/40 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={nome ? `Personagem de ${nome}` : "Personagem"}
              loading="lazy"
              decoding="async"
              className="h-[480px] w-[320px] object-contain"
            />
          </div>
          <Link
            href="/perfil/personagem"
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Pencil size={12} /> Editar personagem
          </Link>
        </>
      ) : (
        <>
          <div className="flex h-[480px] w-[320px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/30">
            <Sparkles size={64} className="text-muted-foreground/50" />
          </div>
          <Link
            href="/perfil/personagem"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110"
          >
            {desbloqueada ? "Montar personagem" : "Criar seu personagem"}
          </Link>
          <p className="text-center text-[10px] leading-tight text-muted-foreground">
            {desbloqueada
              ? "Escolha corpo, rosto, cabelo e acessórios."
              : "Personagem 3D de corpo inteiro. Z$ 100, uma vez."}
          </p>
        </>
      )}
    </div>
  );
}
