import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Trophy, Users, Calendar, Medal } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CONCURSO_ABERTO, CONCURSO_ENABLED, CONCURSO_ESTREIA } from "@/lib/flags";

async function getConcursoData() {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Edição corrente ou, enquanto o Concurso não abre, a próxima agendada.
    const { data: concurso } = await admin
      .from("concursos")
      .select("*")
      .in("status", ["ativo", "agendado"])
      .gte("periodo_fim", now)
      .order("periodo_inicio", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!concurso) return null;

    const { count } = await admin
      .from("inscricoes_concurso")
      .select("*", { count: "exact", head: true })
      .eq("concurso_id", concurso.id);

    return { concurso, inscritos: count ?? 0 };
  } catch {
    return null;
  }
}

export default async function ConcursoAtivo() {
  if (!CONCURSO_ENABLED) return null;
  const data = await getConcursoData();

  // Sem concurso ativo (ou erro na query) esconde a seção — antes tinha
  // fallback com "Temporada Maio" e datas de 05/2026 hardcoded que ficaram
  // stale quando Maio/Junho foram cancelados. Melhor não renderizar do
  // que mostrar dado errado na landing.
  if (!data) return null;

  const titulo = data.concurso.titulo;
  const premioTotal = data.concurso.premiacao_total ?? 20000;
  const inscritos = data.inscritos;
  const inicio = data.concurso.periodo_inicio;
  const fim = data.concurso.periodo_fim;

  const premios = [
    { pos: "1º", valor: "R$ 8.000" },
    { pos: "2º", valor: "R$ 5.000" },
    { pos: "3º", valor: "R$ 3.000" },
    { pos: "4º–5º", valor: "R$ 2.000 cada" },
  ];

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
            {CONCURSO_ABERTO ? "Concurso em andamento" : "O Concurso está chegando"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {CONCURSO_ABERTO
              ? "Inscreva-se agora e dispute o prêmio deste mês."
              : `Ainda não começou. A primeira edição valendo é a de ${CONCURSO_ESTREIA}.`}
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6 sm:p-8 space-y-6">
          {/* Header do concurso */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/20 flex items-center justify-center shrink-0">
                <Trophy size={20} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-yellow-300">{titulo}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-yellow-400/60">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {format(new Date(inicio), "dd/MM", { locale: ptBR })} –{" "}
                    {format(new Date(fim), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  {CONCURSO_ABERTO && inscritos > 0 && (
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {inscritos.toLocaleString("pt-BR")} participante{inscritos !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-xs text-yellow-400/60 mb-0.5">
                {CONCURSO_ABERTO ? "Prêmio total" : "Prêmio total previsto"}
              </p>
              <p className="text-2xl font-black text-yellow-400">
                R$ {Number(premioTotal).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Distribuição de prêmios */}
          <div>
            <p className="text-[10px] text-yellow-400/50 font-semibold uppercase tracking-widest mb-3 flex items-center gap-1">
              <Medal size={10} /> Distribuição
            </p>
            <div className="flex flex-wrap gap-2">
              {premios.map((p) => (
                <div
                  key={p.pos}
                  className="px-3 py-1.5 rounded-lg bg-yellow-400/10 border border-yellow-400/20"
                >
                  <span className="text-xs text-yellow-400 font-bold">{p.pos}</span>
                  <span className="text-xs text-yellow-300/60 ml-1.5">{p.valor}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
            <Link
              href={CONCURSO_ABERTO ? "/concurso/entrar" : "/concurso"}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              {CONCURSO_ABERTO ? "Inscrever-se grátis" : "Ver o Concurso"}
            </Link>
            <p className="text-xs text-yellow-400/50">
              {CONCURSO_ABERTO
                ? "Inscrição automática ao criar conta. Você recebe ZC$ 1.000 pra competir."
                : "As inscrições ainda não abriram — nada do que você fizer hoje conta pro Concurso."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
