"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingDown, Percent, TrendingUp, Flame, Star, User, BookOpen, ShieldCheck, ShieldAlert } from "lucide-react";
import EditProfileForm from "@/components/perfil/EditProfileForm";
import CpfForm from "@/components/kyc/CpfForm";
import TwoFaSettings from "@/components/perfil/TwoFaSettings";
import ReferralSection from "@/components/perfil/ReferralSection";
import { mascaraCPF } from "@/lib/cpf";

interface Props {
  profile: any;
  wallet: any;
  bets: any[];
  referrals: any[];
  appUrl: string;
}

export default function PerfilTabs({ profile, wallet, bets, referrals, appUrl }: Props) {
  const [tab, setTab] = useState<"conta" | "como-funciona">("conta");

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

          {/* Segurança / 2FA */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Segurança</h3>
            <TwoFaSettings
              enabled={profile?.two_fa_enabled ?? false}
              method={profile?.two_fa_method ?? "email"}
              phone={profile?.phone ?? null}
            />
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

      {/* ── COMO FUNCIONA ── */}
      {tab === "como-funciona" && (
        <div className="space-y-4">
          {/* Visão geral */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">O que é a Zafe?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Zafe é uma liga de previsões onde você palpita em eventos do mundo real —
              geopolítica, economia, tecnologia e mais. Se sua previsão estiver certa, você
              recebe parte do que quem errou investiu. Quanto mais certeiros forem seus palpites,
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
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Abertos para qualquer usuário palpitar</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Resolvidos automaticamente por nosso oráculo de IA, que consulta fontes oficiais</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Em caso de contradição entre fontes, um administrador revisa manualmente</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Pool parimutuel: o lucro vem proporcional ao quanto você investiu vs. o total do lado vencedor</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Venda antecipada disponível: use o mercado secundário (aba Vender) para encerrar sua posição antes do fechamento</li>
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
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> Mínimo de 1 juiz aceito por ambos os lados para o bolão começar</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">→</span> O juiz decide o resultado; em caso de erro ou desonestidade, a responsabilidade é dos líderes que o indicaram</li>
            </ul>
          </div>

          {/* Resolução */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Como o resultado é decidido?</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex gap-3 items-start">
                <span className="bg-primary/15 text-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <p>O setor fecha na data definida</p>
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
                <span className="text-muted-foreground">Palpite (pool)</span>
                <span className="text-sim font-medium">Sem comissão</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mercado secundário</span>
                <span className="text-sim font-medium">Sem taxa</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Z$ virtual</span>
                <span className="text-white">Sem valor monetário real</span>
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
