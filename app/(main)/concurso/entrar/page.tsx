export const dynamic = "force-dynamic";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Trophy, Users, Calendar } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar no Concurso — Zafe",
  description: "Crie sua conta e entre para competir no concurso mensal de previsões.",
};

export default async function ConcursoEntrar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Busca concurso ativo
  const { data: concurso } = await admin
    .from("concursos")
    .select("id, titulo, saldo_inicial, premiacao_total, periodo_inicio, periodo_fim")
    .eq("status", "ativo")
    .lte("periodo_inicio", now)
    .gte("periodo_fim", now)
    .single();

  // Contagem de inscritos
  const { count: inscritos } = await admin
    .from("inscricoes_concurso")
    .select("*", { count: "exact", head: true })
    .eq("concurso_id", concurso?.id ?? "");

  if (user && concurso) {
    // Verifica se já inscrito
    const { data: existing } = await admin
      .from("inscricoes_concurso")
      .select("id")
      .eq("user_id", user.id)
      .eq("concurso_id", concurso.id)
      .single();

    if (!existing) {
      // Auto-inscreve
      await admin
        .from("inscricoes_concurso")
        .insert({ user_id: user.id, concurso_id: concurso.id });
      await admin
        .from("concurso_wallets")
        .insert({ user_id: user.id, concurso_id: concurso.id, balance: concurso.saldo_inicial });
    }

    redirect("/concurso");
  }

  if (user && !concurso) {
    redirect("/concurso");
  }

  // Não logado — mostra login/cadastro com contexto do concurso
  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Header do concurso */}
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-400/20 flex items-center justify-center shrink-0">
              <Trophy size={16} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-yellow-300">
                {concurso?.titulo ?? "Concurso Liga Zafe"}
              </p>
              <p className="text-[10px] text-yellow-400/60">
                Inscrição grátis · ZC$ {(concurso?.saldo_inicial ?? 1000).toLocaleString("pt-BR")} de presente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px] text-yellow-400/50">
            {(inscritos ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Users size={10} />
                {(inscritos ?? 0).toLocaleString("pt-BR")} participante{inscritos !== 1 ? "s" : ""}
              </span>
            )}
            <span className="flex items-center gap-1">
              Prêmio total: R$ {Number(concurso?.premiacao_total ?? 500).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        {/* Form de login/cadastro */}
        <LoginForm next="/concurso/entrar" />
      </div>
    </div>
  );
}
