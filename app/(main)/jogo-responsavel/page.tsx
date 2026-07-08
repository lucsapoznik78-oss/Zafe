export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { ShieldCheck, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/server";
import ResponsibleGamingControls from "@/components/responsible/ResponsibleGamingControls";

export const metadata: Metadata = {
  title: "Jogo responsável — Zafe",
  description: "Ferramentas de jogo responsável: pausa temporária, autoexclusão e canais de ajuda.",
  alternates: { canonical: "/jogo-responsavel" },
};

export default async function JogoResponsavelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let cooloffUntil: string | null = null;
  let selfExcludedUntil: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("cooloff_until, self_excluded_until")
      .eq("id", user.id)
      .single();
    const now = Date.now();
    if (profile?.cooloff_until && new Date(profile.cooloff_until).getTime() > now) {
      cooloffUntil = profile.cooloff_until;
    }
    if (profile?.self_excluded_until && new Date(profile.self_excluded_until).getTime() > now) {
      selfExcludedUntil = profile.self_excluded_until;
    }
  }

  const pausaAtiva = selfExcludedUntil ?? cooloffUntil;

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
          <ShieldCheck size={20} className="text-violet-300" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Jogo responsável</h1>
          <p className="text-sm text-muted-foreground">
            A Zafe é uma competição de habilidade com moeda virtual. Ainda assim,
            queremos que sua experiência seja saudável e sob controle.
          </p>
        </div>
      </div>

      {pausaAtiva && (
        <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-4 flex items-start gap-3">
          <Clock size={18} className="text-violet-300 mt-0.5 shrink-0" />
          <div className="text-sm text-violet-100">
            {selfExcludedUntil ? (
              <p>
                Sua conta está em <strong>autoexclusão</strong> até{" "}
                {format(new Date(selfExcludedUntil), "dd/MM/yyyy", { locale: ptBR })}. Para reverter
                antes do prazo, fale com o suporte.
              </p>
            ) : (
              <p>
                Você está em <strong>pausa</strong> até{" "}
                {format(new Date(cooloffUntil!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. O acesso
                volta automaticamente ao fim do período.
              </p>
            )}
          </div>
        </div>
      )}

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-white">Dicas de uso saudável</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Jogue por diversão — os Z$ são virtuais e não viram dinheiro.</li>
          <li>Defina limites de tempo e respeite-os.</li>
          <li>Não tente "recuperar" sequências ruins de palpites.</li>
          <li>Se o jogo deixar de ser divertido, faça uma pausa.</li>
        </ul>
      </section>

      {user ? (
        <ResponsibleGamingControls />
      ) : (
        <p className="text-sm text-muted-foreground">
          Entre na sua conta para usar as ferramentas de pausa e autoexclusão.
        </p>
      )}

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-white">Precisa de ajuda?</h2>
        <p>
          Se você ou alguém próximo sente que o jogo está fora de controle, procure apoio:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>CVV — Centro de Valorização da Vida: ligue 188 (24h, gratuito).</li>
          <li>Jogadores Anônimos Brasil: jogadoresanonimos.com.br.</li>
          <li>Em caso de emergência, ligue 190.</li>
        </ul>
      </section>
    </div>
  );
}
