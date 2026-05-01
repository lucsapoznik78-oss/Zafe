/**
 * Cron de timeouts para apostas privadas — roda de hora em hora
 * Trata todos os prazos automaticamente
 */
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  elegerLider,
  checkLideresEleitos,
  fecharVotacao,
  abrirVotacao,
} from "@/lib/private-bets";
import { reembolsarTodos } from "@/lib/payout";

export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  let handled = 0;

  // ── 1. Recrutamento expirado sem 5 participantes ──────────────────
  const { data: expiredRecruiting } = await supabase
    .from("topics")
    .select("id")
    .eq("is_private", true)
    .eq("private_phase", "recruiting")
    .lt("recruitment_deadline", now);

  for (const t of expiredRecruiting ?? []) {
    const { data: accepted } = await supabase
      .from("topic_participants")
      .select("id").eq("topic_id", t.id).eq("status", "accepted");

    if ((accepted?.length ?? 0) < 5) {
      await reembolsarTodos(supabase, t.id, "Não atingiu 5 participantes em 48h");
      await supabase.from("topics").update({
        private_phase: "cancelled", status: "cancelled",
      }).eq("id", t.id);
      handled++;
    }
  }

  // ── 2. Eleição de líder expirada ──────────────────────────────────
  const { data: expiredElection } = await supabase
    .from("topics")
    .select("id")
    .eq("is_private", true)
    .eq("private_phase", "leader_election")
    .lt("leader_election_deadline", now);

  for (const t of expiredElection ?? []) {
    // Eleger o mais votado (ou mais antigo) em cada lado
    await elegerLider(supabase, t.id, "A");
    await elegerLider(supabase, t.id, "B");
    await checkLideresEleitos(supabase, t.id);
    handled++;
  }

  // ── 3. Auto-aceite de juízes sem resposta em 24h ──────────────────
  const { data: expiredNominations } = await supabase
    .from("judge_nominations")
    .select("id, topic_id, leader_a_approved, leader_b_approved, judge_user_id")
    .eq("status", "proposed")
    .lt("response_deadline", now);

  for (const nom of expiredNominations ?? []) {
    const update: any = {};
    if (nom.leader_a_approved === null) update.leader_a_approved = true;
    if (nom.leader_b_approved === null) update.leader_b_approved = true;

    // Se ambos aprovados → both_approved + notificar juiz
    const aOk = update.leader_a_approved ?? nom.leader_a_approved;
    const bOk = update.leader_b_approved ?? nom.leader_b_approved;

    if (aOk && bOk) {
      update.status = "both_approved";
      update.availability_deadline = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      await supabase.from("notifications").insert({
        user_id: nom.judge_user_id,
        type: "bet_invite",
        title: "Você foi escolhido como juiz!",
        body: "Confirme sua disponibilidade em até 12h.",
        data: { topic_id: nom.topic_id, nomination_id: nom.id, phase: "judge_confirmation" },
      });
    }

    await supabase.from("judge_nominations").update(update).eq("id", nom.id);
    handled++;
  }

  // ── 4. Juiz sem resposta de disponibilidade em 12h → auto-recusa ──
  const { data: expiredAvailability } = await supabase
    .from("judge_nominations")
    .select("id, topic_id")
    .eq("status", "both_approved")
    .lt("availability_deadline", now);

  for (const nom of expiredAvailability ?? []) {
    await supabase.from("judge_nominations").update({ status: "declined" }).eq("id", nom.id);

    // Notificar líderes
    const { data: sides } = await supabase
      .from("topic_sides").select("leader_id").eq("topic_id", nom.topic_id);

    const notifs = (sides ?? []).filter((s: any) => s.leader_id).map((s: any) => ({
      user_id: s.leader_id,
      type: "bet_invite",
      title: "Juiz não respondeu",
      body: "Um juiz não confirmou disponibilidade a tempo. Proponha um substituto.",
      data: { topic_id: nom.topic_id, phase: "judge_negotiation" },
    }));
    if (notifs.length > 0) await supabase.from("notifications").insert(notifs);

    // Volta para negociação
    await supabase.from("topics").update({ private_phase: "judge_negotiation" }).eq("id", nom.topic_id);
    handled++;
  }

  // ── 5. Prazo de negociação total expirado → cancelar ──────────────
  const { data: expiredNegotiation } = await supabase
    .from("topics")
    .select("id")
    .eq("is_private", true)
    .in("private_phase", ["judge_negotiation", "judge_confirmation"])
    .lt("negotiation_deadline", now);

  for (const t of expiredNegotiation ?? []) {
    // Contar juízes ativos
    const { data: active } = await supabase
      .from("judge_nominations").select("id").eq("topic_id", t.id).eq("status", "active");

    if ((active?.length ?? 0) < 3) {
      await reembolsarTodos(supabase, t.id, "Não foi possível confirmar 3 juízes em 72h");
      await supabase.from("topics").update({
        private_phase: "cancelled", status: "cancelled",
      }).eq("id", t.id);
      handled++;
    }
  }

  // ── 6. Aposta ativa com closes_at passado → abrir votação ─────────
  const { data: readyToVote } = await supabase
    .from("topics")
    .select("id")
    .eq("is_private", true)
    .eq("private_phase", "active")
    .lt("closes_at", now);

  for (const t of readyToVote ?? []) {
    await abrirVotacao(supabase, t.id, 1);
    handled++;
  }

  // ── 7. Votação encerrada (prazo de 1h expirado) ───────────────────
  const { data: expiredVoting } = await supabase
    .from("topics")
    .select("id, private_phase")
    .eq("is_private", true)
    .in("private_phase", ["voting", "voting_round2"])
    .lt("judge_vote_deadline", now);

  for (const t of expiredVoting ?? []) {
    const round = t.private_phase === "voting" ? 1 : 2;
    await fecharVotacao(supabase, t.id, round);
    handled++;
  }

  return NextResponse.json({ success: true, handled });
}
