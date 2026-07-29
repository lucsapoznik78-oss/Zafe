/**
 * Canal do Usuário — lista e abertura de conversas com a equipe Zafe.
 *
 * - GET  → conversas do usuário logado (mais recentes primeiro).
 * - POST → abre uma nova conversa com a primeira mensagem.
 *
 * `support_threads`/`support_messages` têm RLS sem policy (migration 068),
 * então a leitura/escrita usa o service role, sempre filtrada por user_id.
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { MAX_CONVERSAS_ABERTAS, MAX_MESSAGE, MAX_SUBJECT, notificarAdmins } from "@/lib/canal";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: threads } = await admin
    .from("support_threads")
    .select("id, subject, status, last_message_at, unread_user, created_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  return NextResponse.json(
    { threads: threads ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (subject.length < 3) {
    return NextResponse.json({ error: "Descreva o assunto (mínimo 3 caracteres)" }, { status: 400 });
  }
  if (subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: `Assunto: máximo de ${MAX_SUBJECT} caracteres` }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Escreva sua mensagem" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: `Mensagem: máximo de ${MAX_MESSAGE} caracteres` }, { status: 400 });
  }

  const admin = createAdminClient();

  const { count: abertas } = await admin
    .from("support_threads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "fechado");

  if ((abertas ?? 0) >= MAX_CONVERSAS_ABERTAS) {
    return NextResponse.json(
      { error: "Você já tem conversas em andamento. Continue por uma delas até a equipe responder." },
      { status: 429 },
    );
  }

  const { data: thread, error } = await admin
    .from("support_threads")
    .insert({ user_id: user.id, subject })
    .select("id, subject, status, last_message_at, unread_user, created_at")
    .single();

  if (error || !thread) {
    return NextResponse.json({ error: "Falha ao abrir a conversa" }, { status: 500 });
  }

  const { error: msgError } = await admin
    .from("support_messages")
    .insert({ thread_id: thread.id, sender_id: user.id, from_admin: false, message });

  if (msgError) {
    // Sem a primeira mensagem a conversa é inútil — desfaz para não sujar a fila.
    await admin.from("support_threads").delete().eq("id", thread.id);
    return NextResponse.json({ error: "Falha ao enviar a mensagem" }, { status: 500 });
  }

  await notificarAdmins(admin, user.id, thread.id, subject);

  return NextResponse.json({ thread });
}
