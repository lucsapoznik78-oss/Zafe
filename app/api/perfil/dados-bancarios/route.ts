/**
 * GET  /api/perfil/dados-bancarios — retorna dados PIX do usuário
 * POST /api/perfil/dados-bancarios — salva/atualiza dados PIX do usuário
 *
 * SQL necessário (rodar no Supabase antes de usar):
 *
 * create table if not exists user_payout_info (
 *   user_id uuid primary key references auth.users(id) on delete cascade,
 *   nome_completo text not null,
 *   cpf text not null unique,
 *   pix_key text not null,
 *   pix_key_type text not null check (pix_key_type in ('cpf','email','celular','chave_aleatoria')),
 *   declaracao_tributacao_aceita_em timestamptz,
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 * );
 *
 * alter table user_payout_info enable row level security;
 * create policy "usuario_le_proprios_dados" on user_payout_info
 *   for select using (auth.uid() = user_id);
 * create policy "usuario_edita_proprios_dados" on user_payout_info
 *   for all using (auth.uid() = user_id);
 */

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_payout_info")
    .select("nome_completo, cpf, pix_key, pix_key_type, declaracao_tributacao_aceita_em, updated_at")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ dados: data ?? null });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { nome_completo, cpf, pix_key, pix_key_type, aceita_declaracao } = await req.json();

  if (!nome_completo?.trim() || !cpf?.trim() || !pix_key?.trim() || !pix_key_type) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
  }

  const tiposValidos = ["cpf", "email", "celular", "chave_aleatoria"];
  if (!tiposValidos.includes(pix_key_type)) {
    return NextResponse.json({ error: "Tipo de chave PIX inválido." }, { status: 400 });
  }

  // CPF limpo (apenas dígitos)
  const cpfLimpo = cpf.replace(/\D/g, "");
  if (cpfLimpo.length !== 11) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const payload: Record<string, any> = {
    user_id: user.id,
    nome_completo: nome_completo.trim(),
    cpf: cpfLimpo,
    pix_key: pix_key.trim(),
    pix_key_type,
    updated_at: now,
  };

  if (aceita_declaracao) {
    payload.declaracao_tributacao_aceita_em = now;
  }

  const { error } = await admin
    .from("user_payout_info")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Este CPF já está cadastrado em outra conta." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao salvar dados." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
