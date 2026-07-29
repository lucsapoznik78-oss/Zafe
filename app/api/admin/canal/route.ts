/**
 * Canal do Usuário — fila do admin.
 *
 * GET → todas as conversas, com o perfil do usuário e uma prévia da última
 * mensagem. Filtro opcional por status (?status=aberto|respondido|fechado).
 *
 * O middleware já barra não-admins em /api/admin/*; a checagem de is_admin
 * aqui é a segunda tranca (padrão das demais rotas de admin).
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupportThreadStatus } from "@/types/database";

const STATUS_VALIDOS: SupportThreadStatus[] = ["aberto", "respondido", "fechado"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const statusParam = new URL(request.url).searchParams.get("status");
  const status = STATUS_VALIDOS.includes(statusParam as SupportThreadStatus)
    ? (statusParam as SupportThreadStatus)
    : null;

  const admin = createAdminClient();
  let query = admin
    .from("support_threads")
    .select("id, user_id, subject, status, last_message_at, unread_admin, created_at")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data: threads } = await query;
  if (!threads?.length) return NextResponse.json({ threads: [] });

  // Perfis e prévias em lote — evita N+1 na fila.
  const userIds = [...new Set(threads.map((t: any) => t.user_id))];
  const [{ data: profiles }, { data: lastMessages }] = await Promise.all([
    admin.from("profiles").select("id, username, full_name").in("id", userIds),
    admin
      .from("support_messages")
      .select("thread_id, message, from_admin, created_at")
      .in("thread_id", threads.map((t: any) => t.id))
      .order("created_at", { ascending: false }),
  ]);

  const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const previewMap = new Map<string, any>();
  for (const m of lastMessages ?? []) {
    if (!previewMap.has(m.thread_id)) previewMap.set(m.thread_id, m);
  }

  return NextResponse.json(
    {
      threads: threads.map((t: any) => ({
        ...t,
        user: profMap.get(t.user_id) ?? null,
        preview: previewMap.get(t.id) ?? null,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
