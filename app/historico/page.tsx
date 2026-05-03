export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import CategoryBadge from "@/components/topicos/CategoryBadge";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, Users, CheckCircle2, XCircle } from "lucide-react";

export default async function HistoricoPage() {
  const supabase = await createClient();

  const { data: resolved } = await supabase
    .from("topics")
    .select("id, title, category, resolution, resolved_at, closes_at")
    .eq("status", "resolved")
    .order("resolved_at", { ascending: false })
    .limit(50);

  // Para cada tópico resolvido, buscar contagem de vencedores
  const topicIds = (resolved ?? []).map((t) => t.id);

  const { data: winStats } = topicIds.length
    ? await supabase
        .from("bets")
        .select("topic_id, user_id")
        .in("topic_id", topicIds)
        .eq("status", "won")
    : { data: [] };

  // Contar vencedores únicos por tópico
  const winnersMap = new Map<string, Set<string>>();
  for (const bet of winStats ?? []) {
    if (!winnersMap.has(bet.topic_id)) winnersMap.set(bet.topic_id, new Set());
    winnersMap.get(bet.topic_id)!.add(bet.user_id);
  }

  const total = resolved?.length ?? 0;
  const totalWinners = [...winnersMap.values()].reduce((s, set) => s + set.size, 0);

  return (
    <div className="min-h-screen bg-black">
      {/* Navbar simples para página pública */}
      <header className="border-b border-border bg-black/90 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/liga" className="text-xl font-bold text-primary">Zafe</Link>
          <div className="flex items-center gap-3">
            <Link href="/liga" className="text-sm text-muted-foreground hover:text-white transition-colors">
              Ver eventos abertos
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 bg-primary text-black text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
            <CheckCircle2 size={12} />
            Transparência total
          </div>
          <h1 className="text-3xl font-bold text-white">Histórico de Resoluções</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Todos os mercados resolvidos na Zafe. Resultado público, auditável por qualquer pessoa.
          </p>
        </div>

        {/* Stats gerais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { icon: <Trophy size={18} />, label: "Mercados resolvidos", value: total, color: "text-primary" },
            { icon: <Users size={18} />, label: "Vencedores únicos", value: totalWinners, color: "text-sim" },
            { icon: <CheckCircle2 size={18} />, label: "Taxa de pagamento", value: total > 0 ? "100%" : "—", color: "text-white" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className={`flex justify-center mb-1 ${s.color}`}>{s.icon}</div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Lista de resoluções */}
        {!resolved?.length ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Trophy size={24} className="text-primary" />
            </div>
            <p className="text-white font-semibold">Nenhum mercado resolvido ainda</p>
            <p className="text-muted-foreground text-sm">
              Os primeiros resultados aparecerão aqui assim que um mercado for encerrado.
            </p>
            <Link
              href="/liga"
              className="inline-block mt-2 px-4 py-2 bg-primary text-black text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Ver eventos abertos
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {resolved.map((topic) => {
              const winners = winnersMap.get(topic.id)?.size ?? 0;
              const isSim = topic.resolution === "sim";

              return (
                <Link key={topic.id} href={`/liga/${topic.id}`}>
                  <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Ícone resultado */}
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                        isSim ? "bg-sim/20" : "bg-nao/20"
                      }`}>
                        {isSim
                          ? <CheckCircle2 size={20} className="text-sim" />
                          : <XCircle size={20} className="text-nao" />
                        }
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CategoryBadge category={topic.category} />
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isSim ? "bg-sim/20 text-sim" : "bg-nao/20 text-nao"
                          }`}>
                            {topic.resolution?.toUpperCase()} venceu
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white line-clamp-2">{topic.title}</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {winners > 0 ? `${winners} vencedor${winners !== 1 ? "es" : ""}` : "Sem investimentos"}
                          </span>
                          {topic.resolved_at && (
                            <span>
                              Resolvido em {format(new Date(topic.resolved_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Indicador visual */}
                      <div className={`hidden sm:block text-right shrink-0`}>
                        <p className={`text-lg font-bold ${isSim ? "text-sim" : "text-nao"}`}>
                          {isSim ? "SIM" : "NÃO"}
                        </p>
                        <p className="text-xs text-muted-foreground">resultado</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
          <p className="text-white font-semibold">Quer investir nos próximos eventos?</p>
          <p className="text-muted-foreground text-sm">
            Crie sua conta e comece a investir em eventos reais com outros usuários.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Criar conta grátis
          </Link>
        </div>
      </main>
    </div>
  );
}
