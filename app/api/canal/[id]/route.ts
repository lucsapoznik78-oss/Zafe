/**
 * Canal do Usuário — uma conversa.
 *
 * - GET  → mensagens da conversa (só do dono) e marca as respostas da equipe
 *   como lidas.
 * - POST → o usuário responde/adiciona mensagem. Conversa fechada é reaberta.
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { MAX_MESSAGE, notificarAdmins } from "@/lib/canal";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: thread } = await admin
    .from("support_threads")
    .select("id, user_id, subject, status, last_message_at, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!thread || thread.user_id !== user.id) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const { data: messages } = await admin
    .from("support_messages")
    .select("id, message, from_admin, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true })
    .limit(300);

  // Abrir a conversa conta como leitura das respostas da equipe.
  await admin.from("support_threads").update({ unread_user: false }).eq("id", thread.id);

  const { user_id: _ownerId, ...threadPublico } = thread;

  return NextResponse.json(
    { thread: threadPublico, messages: messages ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json();
  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  if (text.length > MAX_MESSAGE) {
    return NextResponse.json({ error: `Máximo de ${MAX_MESSAGE} caracteres` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: thread } = await admin
    .from("support_threads")
    .select("id, user_id, subject")
    .eq("id", params.id)
    .maybeSingle();

  if (!thread || thread.user_id !== user.id) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const { data: inserted, error } = await admin
    .from("support_messages")
    .insert({ thread_id: thread.id, sender_id: user.id, from_admin: false, message: text })
    .select("id, message, from_admin, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Falha ao enviar mensagem" }, { status: 500 });
  }

  // Escrever devolve a conversa para a fila da equipe (reabre se estava fechada).
  await admin
    .from("support_threads")
    .update({ status: "aberto", unread_admin: true, last_message_at: new Date().toISOString() })
    .eq("id", thread.id);

  await notificarAdmins(admin, user.id, thread.id, thread.subject);

  return NextResponse.json({ message: inserted });
}
