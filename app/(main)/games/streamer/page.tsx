export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Link2, Users, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LegalFooter from "@/components/layout/LegalFooter";
import StreamerLinkCopy from "@/components/games/StreamerLinkCopy";

export const metadata: Metadata = {
  title: "Painel do Streamer — Zafe Games",
  alternates: { canonical: "/games/streamer" },
};

export default async function StreamerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: o streamer só lê o próprio cadastro/atribuições/ganhos.
  const { data: streamer } = await supabase
    .from("games_streamers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!streamer) {
    return (
      <div className="py-10 space-y-4 max-w-lg">
        <div className="flex items-center gap-2">
          <Link href="/games" className="text-muted-foreground hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-white">Programa de Streamers</h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground space-y-2">
          <p className="text-white font-semibold">Você ainda não é um streamer parceiro.</p>
          <p>
            O programa é por convite. Streamers parceiros ganham um link único, acompanham
            quem trouxeram e recebem participação na receita (sem adiantamento, pago por
            desempenho).
          </p>
          <p>Fale com o time da Zafe para participar.</p>
        </div>
        <LegalFooter />
      </div>
    );
  }

  const [{ count: totalRefs }, { count: confirmedRefs }, { data: earnings }] = await Promise.all([
    supabase.from("games_referrals").select("id", { count: "exact", head: true }).eq("streamer_id", streamer.id),
    supabase.from("games_referrals").select("id", { count: "exact", head: true }).eq("streamer_id", streamer.id).eq("status", "confirmed"),
    supabase.from("games_streamer_earnings").select("amount").eq("streamer_id", streamer.id),
  ]);

  const totalEarnings = (earnings ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe.app.br";
  const link = `${base}/r/${streamer.code}`;

  const cards = [
    { icon: Users, label: "Usuários trazidos", value: String(totalRefs ?? 0) },
    { icon: TrendingUp, label: "Confirmados (Premium)", value: String(confirmedRefs ?? 0) },
    { icon: Wallet, label: "Ganhos acumulados (R$)", value: totalEarnings.toFixed(2) },
  ];

  return (
    <div className="py-6 space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link href="/games" className="text-muted-foreground hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-white">Painel do Streamer</h1>
        <span className="ml-2 text-xs text-muted-foreground">{streamer.display_name}</span>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Link2 size={13} /> Seu link de divulgação · rev share {Number(streamer.rev_share_pct).toFixed(0)}%
        </p>
        <StreamerLinkCopy link={link} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <c.icon size={16} className="text-violet-400 mb-2" />
            <p className="text-2xl font-bold text-white">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Atribuições e ganhos são auditáveis e visíveis apenas para você. Indicações de contas
        duplicadas (mesmo IP/dispositivo) ou autoindicação são rejeitadas automaticamente.
      </p>

      <LegalFooter />
    </div>
  );
}
