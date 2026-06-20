import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// POST /api/admin/games/criar — cria um evento de e-sports (bolão).
// COMPLIANCE (modules/games/COMPLIANCE.md): closes_at SEMPRE antes de
// starts_at (palpite fecha antes do jogo). Reforçado também por constraint
// no banco. Modo pote exige buy_in > 0.

const bodySchema = z
  .object({
    game: z.enum([
      "free_fire", "valorant", "cs2", "lol",
      "ea_fc", "fortnite", "gta", "clash_royale",
      "rocket_league", "dota2", "pubg", "codm", "r6",
    ]),
    tournament: z.string().max(120).nullish(),
    side_a: z.string().min(1).max(80),
    side_b: z.string().min(1).max(80),
    mode: z.enum(["free", "pot"]).default("free"),
    buy_in: z.number().min(0).default(0),
    closes_at: z.string().datetime(),
    starts_at: z.string().datetime(),
    provider: z.string().max(40).nullish(),
    external_id: z.string().max(80).nullish(),
  })
  .refine((b) => new Date(b.closes_at) <= new Date(b.starts_at), {
    message: "O fechamento dos palpites deve ser antes do início do evento",
  })
  .refine((b) => (b.mode === "pot" ? b.buy_in > 0 : b.buy_in === 0), {
    message: "Modo pote exige buy-in > 0; modo grátis exige buy-in 0",
  })
  .refine((b) => b.side_a.trim().toLowerCase() !== b.side_b.trim().toLowerCase(), {
    message: "Os dois lados devem ser diferentes",
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
      { error: parsed.error.issues[0]?.message ?? "Evento inválido" },
      { status: 400 }
    );
  }
  const b = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("games_event")
    .insert({
      game: b.game,
      tournament: b.tournament ?? null,
      side_a: b.side_a.trim(),
      side_b: b.side_b.trim(),
      mode: b.mode,
      buy_in: b.buy_in,
      closes_at: b.closes_at,
      starts_at: b.starts_at,
      provider: b.provider ?? null,
      external_id: b.external_id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[games/criar]", error);
    return NextResponse.json({ error: "Erro ao criar evento" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
