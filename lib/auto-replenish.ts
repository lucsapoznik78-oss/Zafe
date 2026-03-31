/**
 * Auto-reposição de mercados públicos
 *
 * A plataforma mantém sempre um número fixo de mercados ativos:
 *   TARGET_LARGE  = 15 mercados grandes  (min_bet = R$ 20)
 *   TARGET_SMALL  = 15 mercados pequenos (min_bet = R$ 1)
 *
 * Quando um mercado público resolve (com ou sem reembolso), este módulo
 * verifica quantos faltam e cria novos a partir da tabela topic_templates.
 *
 * O creator_id é sempre o primeiro usuário admin — os tópicos entram
 * diretamente como 'active', sem passar por aprovação manual.
 */

const TARGET_LARGE = 15;
const TARGET_SMALL = 15;

const MIN_BET_LARGE = 20;
const MIN_BET_SMALL = 1;

export async function replenishMarkets(supabase: any) {
  // 1. Buscar o admin que vai assinar os tópicos criados automaticamente
  const { data: admin } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .limit(1)
    .single();

  if (!admin) {
    console.error("[auto-replenish] Nenhum admin encontrado.");
    return { created: 0 };
  }

  // 2. Contar mercados públicos ativos por tamanho
  const { data: activeTopics } = await supabase
    .from("topics")
    .select("min_bet")
    .eq("status", "active")
    .eq("is_private", false);

  const activeLarge = (activeTopics ?? []).filter((t: any) => t.min_bet >= MIN_BET_LARGE).length;
  const activeSmall = (activeTopics ?? []).filter((t: any) => t.min_bet < MIN_BET_LARGE).length;

  const needLarge = Math.max(0, TARGET_LARGE - activeLarge);
  const needSmall = Math.max(0, TARGET_SMALL - activeSmall);

  if (needLarge === 0 && needSmall === 0) {
    return { created: 0, activeLarge, activeSmall };
  }

  let created = 0;

  // 3. Buscar templates disponíveis (usado_at = NULL) por tipo
  async function useTemplates(isLarge: boolean, count: number) {
    if (count === 0) return;

    const { data: templates } = await supabase
      .from("topic_templates")
      .select("*")
      .eq("is_large", isLarge)
      .is("used_at", null)
      .order("created_at", { ascending: true })
      .limit(count);

    if (!templates?.length) {
      console.warn(`[auto-replenish] Sem templates disponíveis para is_large=${isLarge}. Pool esgotado.`);
      return;
    }

    for (const tpl of templates) {
      const closesAt = new Date(
        Date.now() + tpl.duration_days * 24 * 60 * 60 * 1000
      ).toISOString();

      // Criar o tópico diretamente como 'active' (criado pela plataforma)
      const { error } = await supabase.from("topics").insert({
        creator_id: admin.id,
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        status: "active",
        min_bet: isLarge ? MIN_BET_LARGE : MIN_BET_SMALL,
        closes_at: closesAt,
        is_private: false,
      });

      if (error) {
        console.error("[auto-replenish] Erro ao criar tópico:", error.message);
        continue;
      }

      // Marcar template como usado
      await supabase
        .from("topic_templates")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tpl.id);

      created++;
    }
  }

  await useTemplates(true, needLarge);
  await useTemplates(false, needSmall);

  console.log(`[auto-replenish] Criados ${created} tópicos. Grandes: ${activeLarge}→${activeLarge + Math.min(needLarge, created)}, Pequenos: ${activeSmall}→${activeSmall + Math.max(0, created - needLarge)}`);

  return { created, activeLarge, activeSmall, needLarge, needSmall };
}
