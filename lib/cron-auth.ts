/**
 * Centraliza a autenticação dos cron endpoints.
 * Aceita Authorization: Bearer <CRON_SECRET>
 */
export function verifyCronAuth(req: Request): boolean {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}
