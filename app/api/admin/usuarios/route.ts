/**
 * GET /api/admin/usuarios?q=<busca>
 *
 * Lista/busca usuários com saldo de carteira (audit #21 — visão de carteira
 * por usuário). Busca por username ou nome; sem `q`, lista os mais recentes.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  let query = admin
    .from("profiles")
    .select("id, username, full_name, is_admin, banned, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) {
    query = query.or(`username.ilike.*${q}*,full_name.ilike.*${q}*`);
  }

  const { data: profiles, error } = await query;
  if (error) {
    console.error("[admin/usuarios]", error);
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  }

  const ids = (profiles ?? []).map((p) => p.id);
  const { data: wallets } = ids.length
    ? await admin.from("wallets").select("user_id, balance").in("user_id", ids)
    : { data: [] as any[] };
  const balanceMap = new Map((wallets ?? []).map((w: any) => [w.user_id, w.balance]));

  return NextResponse.json({
    users: (profiles ?? []).map((p) => ({ ...p, balance: balanceMap.get(p.id) ?? null })),
  });
}
