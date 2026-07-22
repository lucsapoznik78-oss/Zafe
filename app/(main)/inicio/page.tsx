export const dynamic = "force-dynamic";

import Link from "next/link";
import DailyBonusCard from "@/components/inicio/DailyBonusCard";
import { createAdminClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Trophy, ArrowRight, Users, Calendar, Swords, Globe2,
  Gamepad2, Lock, Crown, BarChart3,
} from "lucide-react";

async function getConcurso() {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: concurso } = await admin
      .from("concursos").select("*")
      .eq("status", "ativo").lte("periodo_inicio", now).gte("periodo_fim", now)
      .maybeSingle();
    if (!concurso) return null;
    const { count } = await admin
      .from("inscricoes_concurso")
      .select("*", { count: "exact", head: true })
      .eq("concurso_id", concurso.id);
    return { concurso, inscritos: count ?? 0 };
  } catch {
    return null;
  }
}

const MODULES = [
  { href: "/liga", label: "Liga", desc: "Preveja esporte e e-sports com Z$ virtual", Icon: Swords },
  { href: "/comunidade", label: "Comunidade", desc: "Eventos criados e resolvidos por previsores", Icon: Globe2 },
  { href: "/games", label: "Games", desc: "Desafios rápidos e ao vivo", Icon: Gamepad2 },
  { href: "/privadas", label: "Privadas", desc: "Aposte com amigos em grupos fechados", Icon: Lock },
  { href: "/ranking", label: "Ranking", desc: "Os melhores previsores do Brasil", Icon: BarChart3 },
];

export default async function InicioPage() {
  const data = await getConcurso();
  const titulo = data?.concurso.titulo ?? "Concurso Zafe";
  const premioTotal = Number(data?.concurso.premiacao_total ?? 20000);
  const inscritos = data?.inscritos ?? 0;
  const inicio = data?.concurso.periodo_inicio;
  const fim = data?.concurso.periodo_fim;

  // Regra percentual (300+ inscritos) — ver lib/concurso-premios.ts e
  // /concurso/como-funciona. Abaixo de 300 vale a tabela fixa da migration 050.
  const premios = [
    { pos: "1º", valor: "30% — R$ 6.000" },
    { pos: "2º", valor: "5% — R$ 1.000" },
    { pos: "Top 1%", valor: "45% divididos" },
    { pos: "Top 2%", valor: "20% divididos" },
  ];

  return (
    <div className="space-y-12 pb-8">
      {/* ─────────── BÔNUS DIÁRIO + STREAK ─────────── */}
      <DailyBonusCard />

      {/* ─────────── HERÓI: CONCURSO (mundo pago) ─────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/15 via-yellow-500/5 to-black p-6 sm:p-10">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-yellow-300">
            <Crown size={13} /> Mundo principal · Prêmio em R$
          </div>

          <h1 className="mt-4 text-4xl sm:text-5xl font-black leading-tight text-white">
            {titulo}
          </h1>
          <p className="mt-2 max-w-xl text-sm sm:text-base text-yellow-100/70">
            O fantasy game de esporte e e-sports onde os melhores previsores
            levam dinheiro de verdade por PIX. Prêmio fixo, anunciado na abertura.
          </p>

          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400/60">
                Prêmio total
              </p>
              <p className="text-5xl font-black text-yellow-400">
                R$ {premioTotal.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-yellow-200/60">
              {inicio && fim && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  {format(new Date(inicio), "dd/MM", { locale: ptBR })} –{" "}
                  {format(new Date(fim), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users size={12} />
                {inscritos.toLocaleString("pt-BR")} previsor{inscritos !== 1 ? "es" : ""} na disputa
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {premios.map((p) => (
              <div key={p.pos} className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-1.5">
                <span className="text-xs font-bold text-yellow-400">{p.pos}</span>
                <span className="ml-1.5 text-xs text-yellow-300/60">{p.valor}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/concurso"
              className="group inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-7 py-3.5 text-base font-black text-black transition-colors hover:bg-primary/90"
            >
              <Trophy size={18} />
              Entrar no Concurso
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/concurso/como-funciona"
              className="text-sm font-semibold text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Como funciona →
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── divisor ─────────── */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          ou jogue de graça
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ─────────── ZONA GRÁTIS ─────────── */}
      <section>
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Zona grátis</h2>
          <p className="text-sm text-muted-foreground">
            Tudo com Z$ virtual — sem dinheiro, só habilidade. Esporte e e-sports.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map(({ href, label, desc, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-card"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={18} />
              </div>
              <div>
                <p className="flex items-center gap-1 font-bold text-white">
                  {label}
                  <ArrowRight size={13} className="opacity-0 transition-opacity group-hover:opacity-60" />
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
