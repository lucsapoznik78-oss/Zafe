/**
 * Trava 4 do Privadas (Lei 14.790/2023, Art. 49 — fantasy sport):
 * Limite anual de Z$ por par de usuários em apostas privadas.
 * Default: 5.000 Z$/ano. Configurável via env PRIVATE_BET_LIMIT_Z.
 *
 * SQL necessário (rodar no Supabase):
 * Não precisa de tabela nova — calcula direto dos bets existentes.
 */

export const LIMITE_ANUAL_PAR = parseInt(process.env.PRIVATE_BET_LIMIT_Z ?? "5000");

/**
 * Calcula o volume total de Z$ apostado entre dois usuários em apostas privadas
 * na janela móvel dos últimos 365 dias (apenas bets não reembolsados e não
 * saídos). Janela móvel — e não ano-calendário — evita o reset em 1º de janeiro
 * que permitia dobrar o teto virando o ano.
 */
export async function getVolumeAnualPar(
  admin: any,
  userA: string,
  userB: string
): Promise<number> {
  const inicioJanela = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Buscar topics privados onde userA tem bets na janela
  const { data: betsA } = await admin
    .from("bets")
    .select("topic_id, amount")
    .eq("user_id", userA)
    .eq("is_private", true)
    .gte("created_at", inicioJanela)
    .not("status", "in", '("refunded","exited")');

  if (!betsA || betsA.length === 0) return 0;

  const topicIdsA = [...new Set((betsA as any[]).map((b) => b.topic_id))];

  // Buscar bets de userB nos mesmos topics
  const { data: betsB } = await admin
    .from("bets")
    .select("topic_id, amount")
    .eq("user_id", userB)
    .eq("is_private", true)
    .in("topic_id", topicIdsA)
    .gte("created_at", inicioJanela)
    .not("status", "in", '("refunded","exited")');

  if (!betsB || betsB.length === 0) return 0;

  // Topics onde ambos participaram
  const topicsCompartilhados = new Set((betsB as any[]).map((b) => b.topic_id));

  const totalA = (betsA as any[])
    .filter((b) => topicsCompartilhados.has(b.topic_id))
    .reduce((s, b) => s + Number(b.amount), 0);

  const totalB = (betsB as any[]).reduce((s, b) => s + Number(b.amount), 0);

  return totalA + totalB;
}

/**
 * Verifica se adicionar `novoValor` ultrapassa o limite anual entre dois usuários.
 * Retorna { ok: true } ou { ok: false, mensagem, atual, limite }.
 */
export async function verificarLimiteAnual(
  admin: any,
  userA: string,
  userB: string,
  novoValor: number
): Promise<{ ok: boolean; mensagem?: string; atual?: number; limite?: number }> {
  const atual = await getVolumeAnualPar(admin, userA, userB);
  const limite = LIMITE_ANUAL_PAR;

  if (atual + novoValor > limite) {
    return {
      ok: false,
      mensagem: `Limite anual de Z$ ${limite.toLocaleString("pt-BR")} entre vocês seria excedido. Volume atual: Z$ ${atual.toLocaleString("pt-BR")}.`,
      atual,
      limite,
    };
  }
  return { ok: true };
}
