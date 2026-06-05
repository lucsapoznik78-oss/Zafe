/**
 * Cron: finalizar-concurso
 * Encerra concursos cujo período terminou (status='ativo' e periodo_fim < now),
 * calcula o ranking final (v_concurso_ranking), identifica o top 5% e envia a
 * cada vencedor um email com os detalhes de como resgatar o prêmio em dinheiro.
 * Ao final, marca o concurso como 'apurando'.
 *
 * Frequência sugerida: diária.
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";

async function isAdminRequest(): Promise<boolean> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin === true;
}

type Premio =
  | { posicao: number; valor: number }
  | { posicao_de: number; posicao_ate: number; valor: number };

function premioParaPosicao(premios: Premio[] | null, posicao: number): number | null {
  if (!premios) return null;
  for (const p of premios) {
    if ("posicao" in p && p.posicao === posicao) return p.valor;
    if ("posicao_de" in p && posicao >= p.posicao_de && posicao <= p.posicao_ate) return p.valor;
  }
  return null;
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
      Você terminou o concurso <strong>${titulo}</strong> na <strong>${posicao}ª posição</strong>,
      dentro do <strong>top 5%</strong> do ranking, e conquistou <strong style="color:#facc15">${valorTxt}</strong> em dinheiro.
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
    .select("id, titulo, premios")
    .eq("status", "ativo")
    .lt("periodo_fim", now);

  if (!concursos || concursos.length === 0) {
    return NextResponse.json({ ok: true, message: "Nenhum concurso a finalizar", finalizados: 0 });
  }

  const resultados: any[] = [];

  for (const concurso of concursos) {
    // Ranking final ordenado pela posição
    const { data: ranking } = await admin
      .from("v_concurso_ranking")
      .select("user_id, username, full_name, posicao")
      .eq("concurso_id", concurso.id)
      .order("posicao", { ascending: true });

    const total = ranking?.length ?? 0;
    const topCount = total > 0 ? Math.max(1, Math.ceil(total * 0.05)) : 0;
    const vencedores = (ranking ?? []).slice(0, topCount);

    let enviados = 0;
    for (const v of vencedores) {
      // Email do usuário vem do auth (não está no profile)
      const { data: userRes } = await admin.auth.admin.getUserById(v.user_id);
      const to = userRes?.user?.email;
      if (!to) continue;

      const valor = premioParaPosicao(concurso.premios as Premio[] | null, v.posicao);
      const nome = v.full_name || v.username || "campeão";

      const r = await sendEmail({
        to,
        subject: `🏆 Você está no top 5% do concurso ${concurso.titulo}`,
        html: emailVencedorHtml({ titulo: concurso.titulo, posicao: v.posicao, valor, nome }),
      });
      if (r.ok) enviados++;
    }

    // Marca como apurando (encerrado, aguardando pagamento)
    await admin.from("concursos").update({ status: "apurando" }).eq("id", concurso.id);

    resultados.push({
      concurso_id: concurso.id,
      titulo: concurso.titulo,
      total_inscritos: total,
      top_5pct: topCount,
      emails_enviados: enviados,
    });
  }

  return NextResponse.json({ ok: true, finalizados: resultados.length, resultados });
}
