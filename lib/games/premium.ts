import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Gate Premium da Zafe Games. O palpite básico (grátis e pote) NÃO é gated —
 * só perks avançados (estatísticas detalhadas, histórico). is_premium com
 * premium_until no passado não conta (assinatura expirada).
 */
export async function getIsPremium(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_premium, premium_until")
    .eq("id", userId)
    .maybeSingle();

  if (!data?.is_premium) return false;
  // premium_until null = vitalício; senão precisa estar no futuro.
  if (data.premium_until && new Date(data.premium_until).getTime() <= Date.now()) {
    return false;
  }
  return true;
}
