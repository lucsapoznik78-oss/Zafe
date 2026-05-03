/**
 * Trava 4 do Privadas (pós-CMN 5.298/2026):
 * Limite anual de Z$ por par de usuários em apostas privadas.
 * Default: 5.000 Z$/ano. Configurável via env PRIVATE_BET_LIMIT_Z.
 *
 * SQL necessário (rodar no Supabase):
 * Não precisa de tabela nova — calcula direto dos bets existentes.
 */

export const LIMITE_ANUAL_PAR = parseInt(process.env.PRIVATE_BET_LIMIT_Z ?? "5000");

/**
 * Calcula o volume total de Z$ apostado entre dois usuários em apostas privadas
 * no ano corrente (apenas bets não reembolsados e não saídos).
 */
export async function getVolumeAnualPar(
  admin: any,
  userA: string,
  userB: string
): Promise<number> {
  const ano = new Date().getFullYear();
  const inicioAno = `${ano}-01-01T00:00:00.000Z`;
  const fimAno = `${ano + 1}-01-01T00:00:00.000Z`;

  // Buscar topics privados onde userA tem bets no ano
  const { data: betsA } = await admin
    .from("bets")
    .select("topic_id, amount")
    .eq("user_id", userA)
    .eq("is_private", true)
    .gte("created_at", inicioAno)
    .lt("created_at", fimAno)
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
    .gte("created_at", inicioAno)
    .lt("created_at", fimAno)
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
