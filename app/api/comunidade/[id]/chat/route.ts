/**
 * Chat Premium dos eventos da Comunidade.
 *
 * - GET  → mensagens do evento. Premium recebe a lista; não-premium recebe
 *   { locked: true } (prévia bloqueada na UI). O conteúdo NUNCA sai para o
 *   free — o gate fica aqui, na API.
 * - POST → envia mensagem. Só premium autenticado.
 *
 * A tabela `community_event_chat` tem RLS sem policy, então a leitura/escrita
 * usa o service role (createAdminClient), com o tier validado por isPremium().
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isPremium } from "@/lib/premium";

const MAX_LEN = 500;

async function userIsPremium(supabase: any, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, premium_until")
    .eq("id", userId)
    .maybeSingle();
  return isPremium(profile);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ locked: true });

  if (!(await userIsPremium(supabase, user.id))) {
    return NextResponse.json({ locked: true });
  }

  const admin = createAdminClient();
  const { data: messages } = await admin
    .from("community_event_chat")
    .select("id, message, created_at, user:profiles!user_id(username, full_name)")
    .eq("event_id", params.id)
    .order("created_at", { ascending: true })
    .limit(200);

  return NextResponse.json(
    { locked: false, messages: messages ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!(await userIsPremium(supabase, user.id))) {
    return NextResponse.json(
      { error: "O chat da Comunidade é exclusivo para membros Premium." },
      { status: 403 },
    );
  }

  const { message } = await request.json();
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: `Máximo de ${MAX_LEN} caracteres` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Garante que o evento existe (FK protege, mas devolve 404 amigável).
  const { data: event } = await admin
    .from("community_events")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

  const { data: inserted, error } = await admin
    .from("community_event_chat")
    .insert({ event_id: params.id, user_id: user.id, message: text })
    .select("id, message, created_at, user:profiles!user_id(username, full_name)")
    .single();

  if (error) {
    return NextResponse.json({ error: "Falha ao enviar mensagem" }, { status: 500 });
  }

  return NextResponse.json({ message: inserted });
}
