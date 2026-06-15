/**
 * Gating do tier Premium.
 *
 * Premium é ativado manualmente (admin) nesta fase — sem pagamento/PIX.
 * `premium_until` NULL = vitalício enquanto `is_premium`; com data, expira nela.
 */

interface PremiumFields {
  is_premium?: boolean | null;
  premium_until?: string | null;
}

export function isPremium(profile: PremiumFields | null | undefined): boolean {
  if (!profile?.is_premium) return false;
  if (!profile.premium_until) return true;
  return new Date(profile.premium_until).getTime() > Date.now();
}
