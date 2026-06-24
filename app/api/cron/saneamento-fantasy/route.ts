/**
 * Saneamento fantasy (Art. 49): remove eventos que NÃO são de esporte/e-sports
 * da Liga e do Concurso e MIGRA os palpites para eventos válidos.
 *
 * Para cada evento fora de {esportes, esports} com status active/pending/resolving:
 *   1. devolve o stake de cada palpite à carteira (Z$ na Liga, ZC$ no Concurso) —
 *      isso CONSERVA a moeda (nada é cunhado ou destruído);
 *   2. para palpites binários (sim/nao), debita o mesmo valor e recoloca o palpite,
 *      com o MESMO lado, num evento ativo de esporte/e-sports (round-robin). O
 *      usuário que tinha "nao" no evento X passa a ter "nao" num evento válido;
 *   3. cancela as ordens abertas (Liga) e marca o evento como `cancelled`.
 *
 * Palpites multi-resultado (sem lado sim/nao) só são reembolsados — não há
 * mapeamento de resultado entre eventos distintos.
 *
 * Idempotente o suficiente: só processa eventos ainda não cancelados e palpites
 * em estado vivo (refund usa claim por status). Rode com { dryRun: true } antes.
 *
 * Auth: admin logado OU Authorization: Bearer <CRON_SECRET>.
 */
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { calcOdds } from "@/lib/odds";
import {
  creditBalance,
  debitBalance,
  creditConcursoBalance,
  debitConcursoBalance,
} from "@/lib/wallet";
import { cancelTopicOrders } from "@/lib/order-matching";

const SPORT = ["esportes", "esports"];
const MOTIVO = "Evento fora de esporte/e-sports (pivot fantasy, Art. 49)";

async function isAdminRequest(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin === true;
}

function stakeOf(b: { cost_basis?: number | null; amount: number }): number {
  return b.cost_basis != null ? Number(b.cost_basis) : Number(b.amount);
}

export async function POST(req: Request) {
  const authorized = verifyCronAuth(req) || (await isAdminRequest());
  if (!authorized) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false; // padrão seguro: dryRun a menos que dryRun:false

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Eventos-alvo: binários, ativos, de esporte/e-sports e ainda abertos.
  const { data: targets } = await admin
    .from("topics")
    .select("id, concurso_id, market_type, category")
    .eq("status", "active")
    .in("category", SPORT)
    .gt("closes_at", nowIso);

  const ligaTargets = (targets ?? []).filter(
    (t) => !t.concurso_id && (t.market_type ?? "binary") !== "multi",
  );
  // Concurso ativo (para alvos do concurso e validação de carteira).
  const { data: concursoAtivo } = await admin
    .from("concursos").select("id").eq("status", "ativo")
    .lte("periodo_inicio", nowIso).gte("periodo_fim", nowIso).maybeSingle();
  const concursoTargets = (targets ?? []).filter(
    (t) => t.concurso_id && (t.market_type ?? "binary") !== "multi",
  );

  // Eventos a remover: fora de esporte/e-sports e ainda vivos.
  // Só Liga pública + Concurso. Privadas (is_private) são módulo próprio com sua
  // própria resolução — não são tocadas aqui.
  const { data: aRemover } = await admin
    .from("topics")
    .select("id, title, concurso_id, market_type")
    .not("category", "in", `(${SPORT.join(",")})`)
    .in("status", ["active", "pending", "resolving"])
    .eq("is_private", false);

  const resumo = {
    dryRun,
    eventos_liga: 0,
    eventos_concurso: 0,
    bets_liga_reembolsadas: 0,
    bets_liga_migradas: 0,
    bets_concurso_reembolsadas: 0,
    bets_concurso_migradas: 0,
    ordens_canceladas: 0,
    falhas: [] as string[],
  };

  let ligaIdx = 0;
  let concIdx = 0;

  for (const topic of aRemover ?? []) {
    const isConcurso = !!topic.concurso_id;

    if (isConcurso) {
      resumo.eventos_concurso++;
      const { data: bets } = await admin
        .from("concurso_bets")
        .select("id, user_id, concurso_id, side, amount, outcome_id")
        .eq("topic_id", topic.id)
        .eq("status", "matched");

      for (const b of bets ?? []) {
        const amount = Number(b.amount);
        if (dryRun) {
          resumo.bets_concurso_reembolsadas++;
          if (b.side === "sim" || b.side === "nao") resumo.bets_concurso_migradas++;
          continue;
        }
        // 1) refund (claim matched→refunded para não creditar duas vezes)
        const { data: claimed } = await admin
          .from("concurso_bets").update({ status: "refunded" })
          .eq("id", b.id).eq("status", "matched").select("id");
        if (!claimed || claimed.length === 0) continue;
        const cr = await creditConcursoBalance(admin, b.user_id, b.concurso_id, amount);
        if (!cr.ok) { resumo.falhas.push(`refund concurso bet=${b.id} ${cr.reason}`); continue; }
        resumo.bets_concurso_reembolsadas++;

        // 2) re-place (mesmo lado) num evento ativo do mesmo concurso
        const alvos = concursoTargets.filter((t) => t.concurso_id === b.concurso_id);
        if ((b.side === "sim" || b.side === "nao") && alvos.length > 0) {
          const alvo = alvos[concIdx++ % alvos.length];
          const d = await debitConcursoBalance(admin, b.user_id, b.concurso_id, amount);
          if (d.ok) {
            const { error: e } = await admin.from("concurso_bets").insert({
              user_id: b.user_id, concurso_id: b.concurso_id, topic_id: alvo.id,
              side: b.side, amount, potential_payout: amount * 2, status: "matched",
            });
            if (e) {
              await creditConcursoBalance(admin, b.user_id, b.concurso_id, amount);
              resumo.falhas.push(`replace concurso bet=${b.id} insert`);
            } else {
              resumo.bets_concurso_migradas++;
            }
          }
        }
      }
    } else {
      resumo.eventos_liga++;
      const { data: bets } = await admin
        .from("bets").select("*").eq("topic_id", topic.id)
        .not("status", "in", '("refunded","exited","won","lost")');

      for (const b of bets ?? []) {
        const stake = stakeOf(b);
        if (dryRun) {
          resumo.bets_liga_reembolsadas++;
          if (b.side === "sim" || b.side === "nao") resumo.bets_liga_migradas++;
          continue;
        }
        // 1) refund
        const { data: claimed } = await admin
          .from("bets").update({ status: "refunded" })
          .eq("id", b.id).not("status", "in", '("refunded","exited","won","lost")')
          .select("id");
        if (!claimed || claimed.length === 0) continue;
        const cr = await creditBalance(admin, b.user_id, stake);
        if (!cr.ok) { resumo.falhas.push(`refund liga bet=${b.id} ${cr.reason}`); continue; }
        await admin.from("transactions").insert({
          user_id: b.user_id, type: "bet_refund", amount: stake, net_amount: stake,
          description: `Reembolso — ${MOTIVO}`, reference_id: topic.id,
        });
        resumo.bets_liga_reembolsadas++;

        // 2) re-place (mesmo lado) num evento ativo da Liga
        if ((b.side === "sim" || b.side === "nao") && ligaTargets.length > 0) {
          const alvo = ligaTargets[ligaIdx++ % ligaTargets.length];
          const d = await debitBalance(admin, b.user_id, stake);
          if (d.ok) {
            const { error: e } = await admin.from("bets").insert({
              topic_id: alvo.id, user_id: b.user_id, side: b.side, amount: stake,
              gross_amount: stake, locked_odds: 2, status: "matched",
              matched_amount: stake, unmatched_amount: 0,
              potential_payout: parseFloat((stake * 2).toFixed(2)), is_private: false,
            });
            if (e) {
              await creditBalance(admin, b.user_id, stake);
              resumo.falhas.push(`replace liga bet=${b.id} insert`);
            } else {
              await admin.from("transactions").insert({
                user_id: b.user_id, type: "bet_placed", amount: stake, net_amount: stake,
                description: `Palpite ${b.side.toUpperCase()} migrado — novo evento de esporte`,
                reference_id: alvo.id,
              });
              await admin.from("notifications").insert({
                user_id: b.user_id, type: "bet_matched",
                title: "Seu palpite foi migrado",
                body: `O evento saiu do ar (só esporte/e-sports agora). Seu ${b.side.toUpperCase()} foi movido para um novo evento válido.`,
                data: { topic_id: alvo.id },
              });
              resumo.bets_liga_migradas++;
            }
          }
        }
      }

      if (!dryRun) {
        const r = await cancelTopicOrders(admin, topic.id).catch(() => null);
        if (r) resumo.ordens_canceladas++;
      }
    }

    if (!dryRun) {
      await admin.from("topics").update({ status: "cancelled" }).eq("id", topic.id);
    }
  }

  return NextResponse.json({ ok: true, concurso_ativo: concursoAtivo?.id ?? null, ...resumo });
}
