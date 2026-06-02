/**
 * Envio de email transacional via Resend (HTTP API — sem dependência npm).
 *
 * Requer env:
 *   - RESEND_API_KEY  → chave da API do Resend (https://resend.com)
 *   - EMAIL_FROM      → remetente verificado, ex: "Zafe <premios@zafe.app.br>"
 *
 * Se RESEND_API_KEY não estiver configurada, o envio vira no-op (retorna
 * { ok: false, skipped: true }) para não quebrar o fluxo em ambientes sem email.
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailParams): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Zafe <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY ausente — email não enviado: "${subject}" → ${to}`);
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[email] Falha Resend (${res.status}): ${txt}`);
      return { ok: false, error: `${res.status}: ${txt}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("[email] Erro de rede:", e?.message);
    return { ok: false, error: e?.message };
  }
}
