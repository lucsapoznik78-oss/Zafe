/**
 * Verificação diária dos contadores de bloqueio do rate limit.
 *
 * Vive fora de `lib/ratelimit.ts` porque aquele módulo é importado pelo
 * middleware, que roda no runtime Edge em TODA requisição. Isto aqui puxa o
 * cliente do Supabase e o web push — peso que não pode entrar no bundle do
 * middleware por causa de um alerta que roda uma vez por dia.
 *
 * Por que um contador no Redis e não um alerta sobre log: no plano Hobby da
 * Vercel os Log Drains são pagos e a retenção de log de runtime é de 1 hora.
 * Um pico às 3h da manhã some antes de alguém acordar. O contador sobrevive 26h
 * e é lido aqui.
 *
 * Chamada de carona no `/api/cron/ranking-delta` (diário, 05:30 UTC) — o Hobby
 * limita o número de crons e um slot vale mais para fechar ou resolver mercado.
 */

import { lerBloqueios, LIMIARES } from "@/lib/ratelimit";
import { sendPushToUser } from "@/lib/webpush";

export interface ResultadoAlerta {
  /** `null` quando não há Redis configurado — diferente de "nenhum bloqueio". */
  dia: string;
  bloqueios: Record<string, number> | null;
  indisponivel: Record<string, number> | null;
  alertados: string[];
}

/**
 * `unknown` no lugar do tipo do cliente: `createAdminClient()` já devolve `any`
 * em todo o projeto e não existe tipo gerado para o schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function alertarRateLimit(admin: any): Promise<ResultadoAlerta> {
  // Ontem, não hoje: às 05:30 o dia corrente tem 5h de dado e qualquer limiar
  // diário compararia contra uma amostra parcial.
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const contagem = await lerBloqueios(ontem).catch(() => null);
  if (!contagem) {
    return { dia: ontem, bloqueios: null, indisponivel: null, alertados: [] };
  }

  const linhas: string[] = [];

  // 503 é sempre incidente: significa que o Redis caiu e escritas de dinheiro
  // foram recusadas. Não há limiar — qualquer ocorrência conta.
  for (const [prefixo, n] of Object.entries(contagem.indisponivel)) {
    linhas.push(`${prefixo}: ${n} recusas por Redis fora do ar`);
  }
  for (const [prefixo, n] of Object.entries(contagem.bloqueios)) {
    const limiar = LIMIARES[prefixo];
    if (limiar !== undefined && n > limiar) {
      linhas.push(`${prefixo}: ${n} bloqueios (limiar ${limiar})`);
    }
  }

  if (linhas.length === 0) {
    return { ...contagem, dia: ontem, alertados: [] };
  }

  // Idempotência: se o cron rodar duas vezes no mesmo dia, avisa uma só.
  const marcador = `ratelimit:${ontem}`;
  const { data: jaAvisado } = await admin
    .from("notifications")
    .select("id")
    .eq("type", "admin_alert")
    .contains("data", { marcador })
    .limit(1);
  if (jaAvisado && jaAvisado.length > 0) {
    return { ...contagem, dia: ontem, alertados: [] };
  }

  const { data: admins } = await admin.from("profiles").select("id").eq("is_admin", true);
  const ids: string[] = (admins ?? []).map((a: { id: string }) => a.id);
  if (ids.length === 0) return { ...contagem, dia: ontem, alertados: [] };

  const titulo = "Rate limit: volume acima do esperado";
  const corpo = linhas.join(" · ");

  await admin.from("notifications").insert(
    ids.map((id) => ({
      user_id: id,
      type: "admin_alert",
      title: titulo,
      body: `${ontem} — ${corpo}`,
      data: { marcador, linhas },
    }))
  );

  await Promise.allSettled(
    ids.map((id) => sendPushToUser(admin, id, { title: titulo, body: corpo }))
  );

  return { ...contagem, dia: ontem, alertados: ids };
}
