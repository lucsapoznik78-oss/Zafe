/**
 * Gestão de um usuário pelo admin (audit #21).
 *
 * GET   — perfil + carteira + últimas transações (visão de carteira).
 * PATCH — { banned: boolean } banir/reativar a conta, e/ou
 *         { is_premium: boolean, premium_days?: number } ativar/desativar Premium.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { recordPremiumConversion } from "@/lib/games/streamer";

interface RouteParams { params: Promise<{ id: string }> }

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };

  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return { error: NextResponse.json({ error: "Acesso negado" }, { status: 403 }) };

  return { user };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const admin = createAdminClient();
  const [{ data: profile }, { data: wallet }, { data: transactions }] = await Promise.all([
    admin.from("profiles").select("id, username, full_name, is_admin, banned, is_premium, premium_until, created_at, kyc_verified").eq("id", id).single(),
    admin.from("wallets").select("balance, version").eq("user_id", id).single(),
    admin.from("transactions").select("type, amount, net_amount, description, created_at")
      .eq("user_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  if (!profile) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  return NextResponse.json({ profile, wallet: wallet ?? null, transactions: transactions ?? [] });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const body = await request.json();
  const { banned, is_premium, premium_days } = body;

  const hasBanned = typeof banned === "boolean";
  const hasPremium = typeof is_premium === "boolean";
  if (!hasBanned && !hasPremium) {
    return NextResponse.json(
      { error: "Informe banned (boolean) e/ou is_premium (boolean)" },
      { status: 400 }
    );
  }
  if (hasBanned && banned && id === gate.user!.id) {
    return NextResponse.json({ error: "Você não pode banir a própria conta" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (hasBanned) update.banned = banned;
  if (hasPremium) {
    update.is_premium = is_premium;
    if (is_premium) {
      // premium_days informado → expira em N dias; senão vitalício (null).
      update.premium_until =
        typeof premium_days === "number" && premium_days > 0
          ? new Date(Date.now() + premium_days * 24 * 60 * 60 * 1000).toISOString()
          : null;
    } else {
      update.premium_until = null;
    }
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update(update)
    .eq("id", id)
    .select("id, banned, is_premium, premium_until");

  if (error || !updated?.length) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // Streamer rev share: virou Premium e foi trazido por um streamer → confirma
  // a atribuição e lança o ganho (idempotente). Não bloqueia a resposta.
  if (hasPremium && is_premium) {
    recordPremiumConversion(admin, id).catch((e) =>
      console.error("[admin/usuarios] recordPremiumConversion", e)
    );
  }

  return NextResponse.json({ success: true, ...updated[0] });
}
