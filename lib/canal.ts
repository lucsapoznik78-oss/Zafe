/**
 * Canal do Usuário — helpers compartilhados entre as rotas do usuário
 * (/api/canal/*) e as do admin (/api/admin/canal/*).
 */

export const MAX_SUBJECT = 120;
export const MAX_MESSAGE = 2000;
/** Anti-spam: um usuário não pode empilhar conversas sem resposta. */
export const MAX_CONVERSAS_ABERTAS = 5;

/**
 * Avisa todos os admins (in-app) que há mensagem nova na fila do Canal.
 * Best-effort: falha aqui nunca invalida a mensagem já gravada.
 */
export async function notificarAdmins(
  admin: any,
  userId: string,
  threadId: string,
  subject: string,
) {
  try {
    const [{ data: admins }, { data: autor }] = await Promise.all([
      admin.from("profiles").select("id").eq("is_admin", true),
      admin.from("profiles").select("username").eq("id", userId).maybeSingle(),
    ]);
    if (!admins?.length) return;

    await admin.from("notifications").insert(
      admins.map((a: any) => ({
        user_id: a.id,
        type: "support_message",
        title: "Nova mensagem no Canal",
        body: `@${autor?.username ?? "usuário"}: ${subject.slice(0, 60)}`,
        data: { thread_id: threadId, url: "/admin/canal" },
      })),
    );
  } catch {
    /* notificação é best-effort */
  }
}
