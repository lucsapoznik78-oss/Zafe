import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// POST /api/admin/games/streamer — cadastra um streamer parceiro (por convite).
// Gera/usa um código de referral próprio do programa Games (games_streamers.code),
// separado do referral_code de amigo do perfil.

const bodySchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(80),
  code: z.string().regex(/^[A-Za-z0-9]{3,20}$/, "Código: 3–20 letras/números"),
  rev_share_pct: z.number().min(0).max(100).default(20),
});

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin === true ? user : null;
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }
  const b = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("games_streamers").insert({
    user_id: b.user_id,
    display_name: b.display_name,
    code: b.code.toUpperCase(),
    rev_share_pct: b.rev_share_pct,
  });

  if (error) {
    // 23505 = unique_violation (user já é streamer ou código em uso).
    const msg = error.code === "23505" ? "Usuário já é streamer ou código em uso" : "Erro ao cadastrar streamer";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
