import webpush from "web-push";

function getWebpush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  return webpush;
}

interface PushNotification {
  title: string;
  body: string;
  url?: string;
}

/**
 * Envia push notification para todos os dispositivos registrados de um usuário.
 * Subscriptions inválidas/expiradas são removidas automaticamente.
 */
export async function sendPushToUser(
  supabase: any,
  userId: string,
  notification: PushNotification
) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    data: { url: notification.url ?? "/topicos" },
  });

  await Promise.allSettled(
    subs.map(async (sub: any) => {
      try {
        await getWebpush().sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: any) {
        // Subscription expirada ou inválida → remover
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}

/**
 * Envia push para múltiplos usuários de uma vez (ex: notificar todos os apostadores).
 */
export async function sendPushToMany(
  supabase: any,
  userIds: string[],
  notification: PushNotification
) {
  if (userIds.length === 0) return;
  await Promise.allSettled(
    userIds.map((uid) => sendPushToUser(supabase, uid, notification))
  );
}
