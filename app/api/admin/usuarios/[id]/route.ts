/**
 * Gestão de um usuário pelo admin (audit #21).
 *
 * GET   — perfil + carteira + últimas transações (visão de carteira).
 * PATCH — { banned: boolean } banir/reativar a conta.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
    admin.from("profiles").select("id, username, full_name, is_admin, banned, created_at, kyc_verified").eq("id", id).single(),
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

  const { banned } = await request.json();
  if (typeof banned !== "boolean") {
    return NextResponse.json({ error: "Campo banned (boolean) obrigatório" }, { status: 400 });
  }
  if (id === gate.user!.id) {
    return NextResponse.json({ error: "Você não pode banir a própria conta" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ banned })
    .eq("id", id)
    .select("id, banned");

  if (error || !updated?.length) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true, banned });
}
