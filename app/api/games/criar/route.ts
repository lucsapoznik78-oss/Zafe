import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GAME_KINDS } from "@/lib/games/types";
import { getOrCreateReputation } from "@/lib/comunidade";

// POST /api/games/criar — evento de e-sports criado POR USUÁRIO (estilo
// Comunidade). SEMPRE modo grátis (só pontos, nenhum Z$): o pote continua
// exclusivo de eventos oficiais. O próprio criador resolve depois.
//
// COMPLIANCE (modules/games/COMPLIANCE.md): bolão, não mercado público.
// closes_at SEMPRE antes de starts_at (palpite fecha antes do jogo).

const bodySchema = z
  .object({
    game: z.enum(GAME_KINDS as [string, ...string[]]),
    custom_game: z.string().max(40).nullish(),
    tournament: z.string().max(120).nullish(),
    side_a: z.string().min(1).max(80),
    side_b: z.string().min(1).max(80),
    closes_at: z.string().datetime(),
    starts_at: z.string().datetime(),
  })
  .refine((b) => new Date(b.closes_at) <= new Date(b.starts_at), {
    message: "O fechamento dos palpites deve ser antes do início do evento",
  })
  .refine((b) => b.side_a.trim().toLowerCase() !== b.side_b.trim().toLowerCase(), {
    message: "Os dois lados devem ser diferentes",
  })
  .refine((b) => b.game !== "outros" || !!b.custom_game?.trim(), {
    message: "Digite o nome do jogo",
  });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Evento inválido" },
      { status: 400 }
    );
  }
  const b = parsed.data;

  const now = Date.now();
  const closes = new Date(b.closes_at).getTime();
  const starts = new Date(b.starts_at).getTime();
  if (closes <= now) {
    return NextResponse.json({ error: "O fechamento deve ser no futuro" }, { status: 400 });
  }
  if (starts - now > 90 * 24 * 3600_000) {
    return NextResponse.json({ error: "Prazo máximo: 90 dias" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Mesma régua de reputação da Comunidade (anti-spam de criadores).
  const rep = await getOrCreateReputation(admin, user.id);
  if (!rep || rep.score < 30) {
    return NextResponse.json(
      { error: "Sua nota de criador está abaixo de 30. Não é possível criar eventos." },
      { status: 403 }
    );
  }
  if (rep.blocked_until && new Date(rep.blocked_until).getTime() > now) {
    return NextResponse.json(
      { error: "Você está temporariamente bloqueado de criar eventos." },
      { status: 403 }
    );
  }

  // Rate limit: nº de eventos ativos do usuário (ainda não finalizados).
  const maxActive = rep.score >= 90 ? 10 : 5;
  const { count } = await admin
    .from("games_event")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .in("status", ["scheduled", "live", "under_review"]);
  if ((count ?? 0) >= maxActive) {
    return NextResponse.json(
      { error: `Limite de ${maxActive} eventos ativos. Resolva os pendentes primeiro.` },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("games_event")
    .insert({
      game: b.game,
      custom_game: b.game === "outros" ? b.custom_game!.trim() : null,
      tournament: b.tournament?.trim() || null,
      side_a: b.side_a.trim(),
      side_b: b.side_b.trim(),
      mode: "free",
      buy_in: 0,
      closes_at: b.closes_at,
      starts_at: b.starts_at,
      creator_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[games/criar]", error);
    return NextResponse.json({ error: "Erro ao criar evento" }, { status: 500 });
  }

  await admin
    .from("creator_reputation")
    .update({
      events_created: (rep.events_created ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json({ success: true, id: data.id });
}
