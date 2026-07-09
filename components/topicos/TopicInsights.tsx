"use client";

/**
 * Painel de Insights Premium do evento.
 *
 * - locked:false → conteúdo completo (resumo, pontos-chave, pesquisas, histórico,
 *   contexto, fontes).
 * - locked:true  → prévia borrada com cadeado + CTA "Desbloquear com Premium".
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, Star, ExternalLink } from "lucide-react";
import type { TopicInsightContent } from "@/types/database";

interface InsightsResponse {
  locked: boolean;
  content?: TopicInsightContent | null;
  teaser?: string;
}

export default function TopicInsights({ topicId }: { topicId: string }) {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/liga/${topicId}/insights`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active) setData(j);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [topicId]);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">Insights Premium</span>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
        <p className="text-[11px] text-muted-foreground/80 mt-3">
          Gerando análise com IA e busca na web — pode levar até 30 segundos.
          Aguarde nesta página.
        </p>
      </div>
    );
  }

  if (!data) return null;

  // ── Bloqueado (free/anon): prévia borrada + CTA ─────────────────────────────
  if (data.locked) {
    const teaser =
      data.teaser ||
      "Resumo, pesquisas, histórico e contexto exclusivos deste evento.";
    return (
      <div className="bg-card border border-primary/30 rounded-xl p-5 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">Insights Premium</span>
        </div>

        <div className="relative">
          <div className="blur-sm select-none pointer-events-none space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">{teaser}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {teaser} {teaser}
            </p>
            <div className="h-3 bg-muted rounded w-5/6" />
            <div className="h-3 bg-muted rounded w-4/6" />
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/15 border border-primary/30">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-white font-semibold max-w-xs">
              Pesquisas, histórico e contexto exclusivos deste evento
            </p>
            <Link
              href="/premium"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              <Star className="w-4 h-4" />
              Desbloquear com Premium
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Desbloqueado (Premium): conteúdo completo ───────────────────────────────
  const c = data.content;
  if (!c) return null;

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-bold text-white">Insights Premium</span>
        <span className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-400/15 text-yellow-400">
          PREMIUM
        </span>
      </div>

      {c.resumo && (
        <p className="text-sm text-white leading-relaxed">{c.resumo}</p>
      )}

      {c.pontos_chave.length > 0 && (
        <Section title="Pontos-chave">
          <ul className="space-y-1.5">
            {c.pontos_chave.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
                <span className="text-primary shrink-0">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {c.pesquisas && (
        <Section title="Pesquisas e dados">
          <p className="text-sm text-muted-foreground leading-relaxed">{c.pesquisas}</p>
        </Section>
      )}

      {c.historico && (
        <Section title="Histórico">
          <p className="text-sm text-muted-foreground leading-relaxed">{c.historico}</p>
        </Section>
      )}

      {c.contexto && (
        <Section title="Contexto">
          <p className="text-sm text-muted-foreground leading-relaxed">{c.contexto}</p>
        </Section>
      )}

      {c.fontes.length > 0 && (
        <Section title="Fontes">
          <ul className="space-y-1">
            {c.fontes.map((f, i) => (
              <li key={i}>
                <a
                  href={f}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline break-all"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  {f}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-[10px] text-muted-foreground/70 border-t border-border/40 pt-3">
        Conteúdo informativo gerado por IA para você formar sua própria opinião.
        Não é recomendação de palpite.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/40 pt-4">
      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}
