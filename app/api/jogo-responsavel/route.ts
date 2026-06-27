import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/jogo-responsavel — o usuário ativa uma PAUSA (cool-off) ou a
// AUTOEXCLUSÃO. Princípio de jogo responsável: a rota só ESTENDE o prazo
// (nunca encurta/remove). As colunas são service-role-only (migrations
// 042/051/052), então o usuário não consegue se "auto-liberar" pelo client.
// A autoexclusão é de longo prazo (5 anos) e só pode ser revertida pelo
// suporte — evita reversão impulsiva mantendo recuperabilidade.

const COOLOFF_DIAS = new Set([1, 7, 30, 90]);
const AUTOEXCLUSAO_ANOS = 5;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const admin = createAdminClient();
  const now = Date.now();

  const { data: profile } = await admin
    .from("profiles")
    .select("cooloff_until, self_excluded_until")
    .eq("id", user.id)
    .single();

  if (action === "cooloff") {
    const days = Number(body?.days);
    if (!COOLOFF_DIAS.has(days)) {
      return NextResponse.json({ error: "Período de pausa inválido." }, { status: 400 });
    }
    const novo = now + days * 24 * 3600_000;
    const atual = profile?.cooloff_until ? new Date(profile.cooloff_until).getTime() : 0;
    // Só estende — nunca encurta uma pausa já ativa.
    const alvo = new Date(Math.max(novo, atual)).toISOString();
    const { error } = await admin.from("profiles").update({ cooloff_until: alvo }).eq("id", user.id);
    if (error) return NextResponse.json({ error: "Erro ao ativar a pausa" }, { status: 500 });
    return NextResponse.json({ success: true, cooloff_until: alvo });
  }

  if (action === "self_exclude") {
    const novo = now + AUTOEXCLUSAO_ANOS * 365 * 24 * 3600_000;
    const atual = profile?.self_excluded_until ? new Date(profile.self_excluded_until).getTime() : 0;
    const alvo = new Date(Math.max(novo, atual)).toISOString();
    const { error } = await admin.from("profiles").update({ self_excluded_until: alvo }).eq("id", user.id);
    if (error) return NextResponse.json({ error: "Erro ao ativar a autoexclusão" }, { status: 500 });
    return NextResponse.json({ success: true, self_excluded_until: alvo });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
