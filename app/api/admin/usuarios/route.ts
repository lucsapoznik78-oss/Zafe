/**
 * GET /api/admin/usuarios?q=<busca>
 *
 * Lista/busca usuários com saldo de carteira (audit #21 — visão de carteira
 * por usuário). Ranqueado do MAIS ativo ao menos ativo: a ordem é pela
 * quantidade de palpites nos últimos 30 dias (proxy de atividade — não há
 * instrumentação de sessão). Sem `q`, mostra os usuários mais ativos e
 * completa com cadastros recentes (para não esconder quem ainda não palpitou).
 * Com `q`, filtra por username/nome e ordena o resultado pela atividade.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PROFILE_COLS =
  "id, username, full_name, is_admin, banned, is_premium, premium_until, created_at, self_excluded_until, cooloff_until";
const LIMITE = 50;
const JANELA_DIAS = 30;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const url = new URL(request.url);
  // Remove caracteres estruturais do PostgREST antes de interpolar no .or() (cf. H6)
  const q = (url.searchParams.get("q") ?? "").replace(/[,()."*\\%_]/g, "").trim();

  // Atividade dos últimos 30 dias: contagem de palpites por usuário (proxy de
  // atividade, consistente com o monitoramento de jogo responsável).
  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data: betRows } = await admin.from("bets").select("user_id").gte("created_at", desde);
  const atividadeMap = new Map<string, number>();
  for (const b of betRows ?? []) {
    atividadeMap.set(b.user_id, (atividadeMap.get(b.user_id) ?? 0) + 1);
  }

  let profiles: any[] = [];

  if (q) {
    const { data, error } = await admin
      .from("profiles")
      .select(PROFILE_COLS)
      .or(`username.ilike.*${q}*,full_name.ilike.*${q}*`)
      .limit(LIMITE);
    if (error) {
      console.error("[admin/usuarios]", error);
      return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
    }
    profiles = data ?? [];
  } else {
    // Candidatos: ids mais ativos (por palpites/30d) + cadastros recentes para
    // completar até o limite, sem esconder quem ainda não palpitou.
    const idsAtivos = [...atividadeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, LIMITE)
      .map(([id]) => id);

    const { data: recentes } = await admin
      .from("profiles")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(LIMITE);

    const idSet = new Set(idsAtivos);
    for (const r of recentes ?? []) {
      if (idSet.size >= LIMITE) break;
      idSet.add(r.id);
    }

    const ids = [...idSet];
    if (ids.length) {
      const { data, error } = await admin.from("profiles").select(PROFILE_COLS).in("id", ids);
      if (error) {
        console.error("[admin/usuarios]", error);
        return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
      }
      profiles = data ?? [];
    }
  }

  const ids = profiles.map((p) => p.id);
  const { data: wallets } = ids.length
    ? await admin.from("wallets").select("user_id, balance").in("user_id", ids)
    : { data: [] as any[] };
  const balanceMap = new Map((wallets ?? []).map((w: any) => [w.user_id, w.balance]));

  // Ordena do mais ativo ao menos ativo; empate desfeito pelo cadastro mais recente.
  const users = profiles
    .map((p) => ({
      ...p,
      balance: balanceMap.get(p.id) ?? null,
      palpites30d: atividadeMap.get(p.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.palpites30d - a.palpites30d ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return NextResponse.json({ users });
}
