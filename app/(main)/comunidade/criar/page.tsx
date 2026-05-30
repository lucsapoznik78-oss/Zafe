export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CommunityCreateForm from "@/components/comunidade/CommunityCreateForm";
import { getOrCreateReputation } from "@/lib/comunidade";

export const metadata = { title: "Criar Evento — Comunidade Zafe" };

export default async function CriarComunidadePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const rep = await getOrCreateReputation(admin, user.id);

  return (
    <div className="py-6 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Criar Evento</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Crie um evento para a galera palpitar. Você será o juiz.
        </p>
      </div>

      {rep && rep.score < 30 ? (
        <div className="bg-nao/10 border border-nao/30 rounded-xl p-4 text-center">
          <p className="text-sm text-nao">Sua nota de criador ({rep.score}) está abaixo de 30.</p>
          <p className="text-xs text-muted-foreground mt-1">Não é possível criar eventos no momento.</p>
        </div>
      ) : rep?.blocked_until && new Date(rep.blocked_until) > new Date() ? (
        <div className="bg-nao/10 border border-nao/30 rounded-xl p-4 text-center">
          <p className="text-sm text-nao">Você está bloqueado até {new Date(rep.blocked_until).toLocaleDateString("pt-BR")}.</p>
        </div>
      ) : (
        <CommunityCreateForm creatorScore={rep?.score ?? 50} />
      )}
    </div>
  );
}
