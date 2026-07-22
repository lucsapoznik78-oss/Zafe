/**
 * Cron: finalizar-concurso
 * Encerra concursos cujo período terminou (status='ativo' e periodo_fim < now),
 * calcula o ranking final (v_concurso_ranking), aplica a regra de premiação
 * (lib/concurso-premios.ts — tabela fixa <300 inscritos, percentuais 300+,
 * com tratamento de empates) e envia a cada vencedor um email com os detalhes
 * de como resgatar o prêmio em dinheiro. Ao final, marca como 'apurando'.
 *
 * Frequência sugerida: diária.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { registrarPayoutsVencedores } from "@/lib/concurso-pagamento";
import { calcularPremiacao, type PremioFixo } from "@/lib/concurso-premios";

async function isAdminRequest(): Promise<boolean> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin === true;
}

function emailVencedorHtml(params: {
  titulo: string;
  posicao: number;
  valor: number | null;
  nome: string;
}): string {
  const { titulo, posicao, valor, nome } = params;
  const valorTxt = valor != null ? `R$ ${valor.toLocaleString("pt-BR")}` : "um prêmio";
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#fafafa;padding:32px;border-radius:16px">
    <div style="font-size:13px;color:#facc15;font-weight:700;letter-spacing:.05em;text-transform:uppercase">Zafe Concurso</div>
    <h1 style="font-size:22px;margin:8px 0 4px">Parabéns, ${nome}! 🏆</h1>
    <p style="color:#d4d4d8;font-size:15px;line-height:1.6">
      Você terminou o concurso <strong>${titulo}</strong> na <strong>${posicao}ª posição</strong>
      do ranking e conquistou <strong style="color:#facc15">${valorTxt}</strong> em dinheiro.
    </p>
    <div style="background:rgba(250,204,21,.1);border:1px solid rgba(250,204,21,.25);border-radius:12px;padding:16px;margin:20px 0">
      <p style="margin:0;font-size:14px;color:#fde68a;line-height:1.6">
        <strong>Como resgatar:</strong> responda este email com a sua chave PIX e o nome completo
        do titular da conta. Confirmaremos os dados e faremos o pagamento em até 7 dias úteis.
      </p>
    </div>
    <p style="color:#71717a;font-size:12px;line-height:1.6">
      O pagamento é feito somente para a conta do titular cadastrado na Zafe. Em caso de dúvidas,
      responda este email. Obrigado por participar!
    </p>
  </div>`;
}

// Vercel cron dispatch é GET; reaproveita o mesmo handler (declaração hoisted).
export const GET = POST;

export async function POST(req: Request) {
  const authorized = verifyCronAuth(req) || (await isAdminRequest());
  if (!authorized) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Concursos que já terminaram mas ainda estão marcados como ativos
  const { data: concursos } = await admin
    .from("concursos")
    .select("id, titulo, premios, premiacao_total")
    .eq("status", "ativo")
    .lt("periodo_fim", now);

  if (!concursos || concursos.length === 0) {
    return NextResponse.json({ ok: true, message: "Nenhum concurso a finalizar", finalizados: 0 });
  }

  const resultados: any[] = [];

  for (const concurso of concursos) {
    // Ranking final com saldo real (empates tratados em calcularPremiacao)
    const { data: ranking } = await admin
      .from("v_concurso_ranking")
      .select("user_id, username, full_name, saldo_atual")
      .eq("concurso_id", concurso.id)
      .order("saldo_atual", { ascending: false });

    const total = ranking?.length ?? 0;

    // Regra de premiação: tabela fixa (<300 inscritos) ou percentuais (300+),
    // sempre com divisão em caso de empate.
    const premiosCalculados = calcularPremiacao(
      Number(concurso.premiacao_total ?? 0),
      concurso.premios as PremioFixo[] | null,
      (ranking ?? []).map((r) => ({ user_id: r.user_id, balance: Number(r.saldo_atual) }))
    );
    const vencedores = premiosCalculados.filter((p) => p.valorCentavos > 0);
    const perfilPorId = new Map((ranking ?? []).map((r) => [r.user_id, r]));

    const payoutEntries: { userId: string; posicao: number; valorCentavos: number }[] = [];
    let enviados = 0;
    for (const v of vencedores) {
      payoutEntries.push({ userId: v.user_id, posicao: v.posicao, valorCentavos: v.valorCentavos });

      // Email do usuário vem do auth (não está no profile)
      const { data: userRes } = await admin.auth.admin.getUserById(v.user_id);
      const to = userRes?.user?.email;
      if (!to) continue;

      const perfil = perfilPorId.get(v.user_id);
      const nome = perfil?.full_name || perfil?.username || "campeão";
      const valor = v.valorCentavos / 100;

      const r = await sendEmail({
        to,
        subject: `🏆 Você foi premiado no concurso ${concurso.titulo}`,
        html: emailVencedorHtml({ titulo: concurso.titulo, posicao: v.posicao, valor, nome }),
      });
      if (r.ok) enviados++;
    }

    // Razão de prêmios (R$ via PIX) — idempotente. Fonte de verdade do payout.
    const payoutsRegistrados = await registrarPayoutsVencedores(admin, concurso.id, payoutEntries);

    // Marca como apurando (encerrado, aguardando pagamento)
    await admin.from("concursos").update({ status: "apurando" }).eq("id", concurso.id);

    resultados.push({
      concurso_id: concurso.id,
      titulo: concurso.titulo,
      total_inscritos: total,
      premiados: vencedores.length,
      emails_enviados: enviados,
      payouts_registrados: payoutsRegistrados,
    });
  }

  return NextResponse.json({ ok: true, finalizados: resultados.length, resultados });
}
