/**
 * Canal do Usuário — conversa vista pelo admin.
 *
 * - GET   → mensagens + dados do usuário; marca a conversa como lida pela equipe.
 * - POST  → resposta do admin (notificação in-app + push para o usuário).
 * - PATCH → fecha ou reabre a conversa.
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/webpush";
import { MAX_MESSAGE } from "@/lib/canal";

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return data?.is_admin === true ? user : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const { data: thread } = await admin
    .from("support_threads")
    .select("id, user_id, subject, status, last_message_at, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!thread) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const [{ data: messages }, { data: profile }] = await Promise.all([
    admin
      .from("support_messages")
      .select("id, message, from_admin, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(300),
    admin.from("profiles").select("id, username, full_name").eq("id", thread.user_id).maybeSingle(),
  ]);

  await admin.from("support_threads").update({ unread_admin: false }).eq("id", thread.id);

  return NextResponse.json(
    { thread: { ...thread, user: profile ?? null }, messages: messages ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

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

  if (!thread) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const { data: inserted, error } = await admin
    .from("support_messages")
    .insert({ thread_id: thread.id, sender_id: user.id, from_admin: true, message: text })
    .select("id, message, from_admin, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Falha ao enviar resposta" }, { status: 500 });

  await admin
    .from("support_threads")
    .update({
      status: "respondido",
      unread_user: true,
      unread_admin: false,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", thread.id);

  // Avisa o usuário pelos dois canais, sem bloquear a resposta da API.
  const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text;
  await Promise.allSettled([
    admin.from("notifications").insert({
      user_id: thread.user_id,
      type: "support_reply",
      title: "A equipe Zafe respondeu",
      body: preview,
      data: { thread_id: thread.id, url: `/canal?conversa=${thread.id}` },
    }),
    sendPushToUser(admin, thread.user_id, {
      title: "A equipe Zafe respondeu 💬",
      body: preview,
      url: `/canal?conversa=${thread.id}`,
    }),
  ]);

  return NextResponse.json({ message: inserted });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { status } = await request.json();
  if (status !== "fechado" && status !== "aberto") {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("support_threads")
    .update({ status, unread_admin: false })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: "Falha ao atualizar" }, { status: 500 });

  return NextResponse.json({ success: true, status });
}
