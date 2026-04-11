"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingDown, Percent, TrendingUp, Flame, Star, User, BookOpen, LayoutList, ShieldCheck, ShieldAlert } from "lucide-react";
import EditProfileForm from "@/components/perfil/EditProfileForm";
import CpfForm from "@/components/kyc/CpfForm";
import ReferralSection from "@/components/perfil/ReferralSection";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { mascaraCPF } from "@/lib/cpf";

const SIDE_STATUS: Record<string, { label: string; class: string }> = {
  won:      { label: "Ganhou",           class: "text-sim" },
  lost:     { label: "Perdeu",           class: "text-nao" },
  pending:  { label: "Pendente",         class: "text-yellow-400" },
  matched:  { label: "Em jogo",          class: "text-primary" },
  partial:  { label: "Parcial",          class: "text-orange-400" },
  refunded: { label: "Reembolso",        class: "text-muted-foreground" },
  exited:   { label: "Saída antecipada", class: "text-yellow-400" },
};

interface Props {
  profile: any;
  wallet: any;
  bets: any[];
  referrals: any[];
  appUrl: string;
}

export default function PerfilTabs({ profile, wallet, bets, referrals, appUrl }: Props) {
  const [tab, setTab] = useState<"conta" | "eventos" | "como-funciona">("conta");

  const betsWon    = bets.filter((b) => b.status === "won").length;
  const betsLost   = bets.filter((b) => b.status === "lost").length;
  const resolved   = bets.filter((b) => b.status === "won" || b.status === "lost");
  const winRate    = resolved.length > 0 ? (betsWon / resolved.length) * 100 : 0;
  const initials   = profile?.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";

  const totalPnl = resolved.reduce((sum: number, b: any) => {
    if (b.status === "won") return sum + ((b.potential_payout ?? 0) - b.amount);
    return sum - b.amount;
  }, 0);

  const sortedResolved = [...resolved].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  let streak = 0;
  for (const b of sortedResolved) {
    if (b.status === "won") streak++;
    else break;
  }

  const CATEGORY_LABELS: Record<string, string> = {
    politica: "Política", economia: "Economia", esportes: "Esportes",
    tecnologia: "Tecnologia", entretenimento: "Entretenimento", internacional: "Internacional", outro: "Outro",
  };
  const catStats: Record<string, { won: number; total: number }> = {};
  for (const b of resolved as any[]) {
    const cat = b.topic?.category ?? "outro";
    if (!catStats[cat]) catStats[cat] = { won: 0, total: 0 };
    catStats[cat].total++;
    if (b.status === "won") catStats[cat].won++;
  }
  let bestCat: string | null = null, bestRate = 0;
  for (const [cat, s] of Object.entries(catStats)) {
    if (s.total >= 2 && s.won / s.total > bestRate) { bestRate = s.won / s.total; bestCat = cat; }
  }
  const totalReferrals    = referrals.length;
  const completedReferrals = referrals.filter((r) => r.status === "completed").length;

  const tabs = [
    { id: "conta",          label: "Conta",          icon: <User size={14} /> },
    { id: "eventos",        label: "Eventos",         icon: <LayoutList size={14} /> },
    { id: "como-funciona",  label: "Como funciona",   icon: <BookOpen size={14} /> },
  ] as const;

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{profile?.full_name}</h1>
          <p className="text-muted-foreground text-sm">@{profile?.username}</p>
          <p className="text-primary font-semibold mt-1">{formatCurrency(wallet?.balance ?? 0)}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: <Trophy size={16} />,      label: "Ganhas",         value: betsWon,                     color: "text-sim" },
          { icon: <TrendingDown size={16} />, label: "Perdidas",       value: betsLost,                    color: "text-nao" },
          { icon: <Percent size={16} />,      label: "Taxa de acerto", value: `${winRate.toFixed(1)}%`,    color: "text-primary" },
          {
            icon: totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
            label: "Lucro/Prejuízo",
            value: `${totalPnl >= 0 ? "+" : ""}${formatCurrency(totalPnl)}`,
            color: totalPnl >= 0 ? "text-sim" : "text-nao",
          },
          {
            icon: <Flame size={16} />,
            label: "Sequência atual",
            value: streak > 0 ? `${streak}🔥` : "—",
            color: streak >= 3 ? "text-orange-400" : "text-white",
          },
          {
            icon: <Star size={16} />,
            label: "Melhor categoria",
            value: bestCat ? `${CATEGORY_LABELS[bestCat] ?? bestCat} (${(bestRate * 100).toFixed(0)}%)` : "—",
            color: "text-yellow-400",
          },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <div className={`flex justify-center mb-1 ${s.color}`}>{s.icon}</div>
            <p className={`text-base font-bold ${s.color} leading-tight`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTA ── */}
      {tab === "conta" && (
        <div className="space-y-4">
          {/* Dados da conta */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Dados da conta</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Nome</span>
                <span className="text-white font-medium">{profile?.full_name ?? "—"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Usuário</span>
                <span className="text-white font-mono">@{profile?.username ?? "—"}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-muted-foreground">E-mail</span>
                <span className="text-white">{profile?.email ?? "—"}</span>
              </div>
            </div>
            <EditProfileForm fullName={profile?.full_name ?? ""} username={profile?.username ?? ""} />
          </div>

          {/* KYC */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              {profile?.kyc_verified
                ? <ShieldCheck size={15} className="text-sim" />
                : <ShieldAlert size={15} className="text-yellow-400" />}
              <h3 className="text-sm font-semibold text-white">Verificação de identidade</h3>
              {profile?.kyc_verified && (
                <span className="ml-auto px-1.5 py-0.5 bg-sim/20 text-sim text-xs rounded font-bold">Verificado</span>
              )}
            </div>
            {profile?.kyc_verified ? (
              <p className="text-xs text-muted-foreground">
                CPF cadastrado: <span className="text-white font-mono">{mascaraCPF(profile.cpf ?? "")}</span>
              </p>
            ) : (
              <CpfForm />
            )}
          </div>

          {/* Referral */}
          {profile?.referral_code && (
            <ReferralSection
              referralCode={profile.referral_code}
              totalReferrals={totalReferrals}
              completedReferrals={completedReferrals}
              appUrl={appUrl}
            />
          )}
        </div>
      )}

      {/* ── EVENTOS ── */}
      {tab === "eventos" && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">
            Eventos participados <span className="text-muted-foreground font-normal">({bets.length})</span>
          </h3>
          {!bets.length ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum evento ainda</p>
          ) : (
            <div className="space-y-0">
              {bets.map((bet) => {
                const status = SIDE_STATUS[bet.status] ?? { label: bet.status, class: "text-muted-foreground" };
                const isPrivate = bet.topic?.is_private;
                return (
                  <div key={bet.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <Link href={`/topicos/${bet.topic?.id}`} className="hover:text-primary transition-colors">
                        <p className="text-sm text-white truncate">{bet.topic?.title}</p>
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {bet.topic?.category && <CategoryBadge category={bet.topic.category} />}
                        {isPrivate && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">Privado</span>
                        )}
                        <span className={`text-xs font-semibold ${bet.side === "sim" ? "text-sim" : "text-nao"}`}>
                          {bet.side.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(bet.created_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white">{formatCurrency(bet.amount)}</p>
                      <p className={`text-xs ${status.class}`}>{status.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── COMO FUNCIONA ── */}
      {tab === "como-funciona" && (
        <div className="space-y-4">
          {/* Visão geral */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">O que é a Zafe?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Zafe é um mercado de previsões onde você aposta em eventos do mundo real —
              geopolítica, economia, tecnologia e mais. Se sua previsão estiver certa, você
              recebe parte do que quem errou apostou. Quanto mais certeiros forem seus palpites,
              maior seu lucro.
            </p>
          </div>

          {/* Públicos */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sim shrink-0" />
              <h3 className="text-sm font-semibold text-white">Eventos Públicos</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Abertos para qualquer usuário apostar</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Resolvidos automaticamente por nosso oráculo de IA, que consulta fontes oficiais</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Em caso de contradição entre fontes, um administrador revisa manualmente</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Pool parimutuel: o lucro vem proporcional ao quanto você apostou vs. o total do lado vencedor</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Saída antecipada disponível: receba 96% do valor de volta a qualquer momento antes do fechamento</li>
            </ul>
          </div>

          {/* Privados */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <h3 className="text-sm font-semibold text-white">Eventos Privados</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Criados por você para disputar com amigos ou grupos específicos</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Duas equipes (Lado A vs. Lado B) com líderes que controlam quem entra</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Juiz escolhido e aprovado por ambos os líderes — a plataforma não interfere no julgamento</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Mínimo de 1 juiz aceito por ambos os lados para a aposta começar</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> O juiz decide o resultado; em caso de erro ou desonestidade, a responsabilidade é dos líderes que o indicaram</li>
            </ul>
          </div>

          {/* Resolução */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Como o resultado é decidido?</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex gap-3 items-start">
                <span className="bg-primary/15 text-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <p>O mercado fecha na data definida</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="bg-primary/15 text-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <p>Nosso oráculo consulta 3 fontes independentes e compara os resultados</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="bg-primary/15 text-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <p>Se houver consenso, o pagamento é automático em segundos</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="bg-primary/15 text-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                <p>Se houver contradição entre as fontes, um administrador revisa e decide manualmente</p>
              </div>
            </div>
          </div>

          {/* Taxas */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">Taxas</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Depósito</span>
                <span className="text-white">6% (comissão Zafe)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saída antecipada</span>
                <span className="text-white">6% (recebe 94% de volta)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saque</span>
                <span className="text-white">Gratuito (mín. Z$ 20,00)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ganhos</span>
                <span className="text-sim font-medium">Sem taxa adicional</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
