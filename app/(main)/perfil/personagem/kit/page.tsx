// Preview isolada dos 5 avatares do kit oficial (Enrico, 21/08/2026).
// Rota separada do editor principal (/perfil/personagem) enquanto o catálogo
// procedural `av-*` continua sendo o sistema em produção. Quando bater o
// alinhamento com a outra frente que mexe no EditorPersonagem, dá pra
// migrar/integrar sem conflito.

export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import ZafeAvatarKit from "@/components/figura3d/ZafeAvatarKit";
import { AVATARES_KIT, COLECIONAVEIS_KIT } from "@/lib/figura/avatares-kit";

export default function KitPreviewPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/perfil/personagem"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Voltar ao editor
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-bold">Kit oficial — 5 personagens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modelos 3D pré-cozidos com rig e textura. Preview visual — ainda não
          conectado à loja/equipar.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AVATARES_KIT.map((a) => (
          <article
            key={a.id}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <ZafeAvatarKit personagem={a.id} tamanho={280} />
            <div className="text-center">
              <h2 className="text-base font-semibold">{a.nome}</h2>
              <p className="text-xs italic text-muted-foreground">{a.vibe}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                {a.assinatura}
              </p>
              <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {a.raridade}
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">Colecionáveis</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {COLECIONAVEIS_KIT.map((c) => (
            <div
              key={c.id}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.arquivo}
                alt={c.nome}
                loading="lazy"
                className="h-32 w-full object-contain"
              />
              <p className="text-center text-[11px] font-medium leading-tight">
                {c.nome}
              </p>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                  c.raridade === "raro"
                    ? "bg-yellow-500/15 text-yellow-400"
                    : c.raridade === "lendario"
                      ? "bg-purple-500/15 text-purple-400"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {c.raridade}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
