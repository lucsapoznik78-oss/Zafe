export const dynamic = "force-dynamic";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import GameCreateForm from "@/components/games/GameCreateForm";
import { getOrCreateReputation } from "@/lib/comunidade";

export const metadata = { title: "Criar evento — Zafe Games" };

export default async function CriarGameEventPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const rep = await getOrCreateReputation(admin, user.id);

  const blocked = rep?.blocked_until && new Date(rep.blocked_until) > new Date();

  return (
    <div className="py-6 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Gamepad2 size={22} className="text-primary" /> Criar evento
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Monte um confronto para a galera palpitar. Você será o juiz.
        </p>
      </div>

      {rep && rep.score < 30 ? (
        <div className="bg-nao/10 border border-destructive/30 rounded-xl p-4 text-center">
          <p className="text-sm text-destructive">Sua nota de criador ({rep.score}) está abaixo de 30.</p>
          <p className="text-xs text-muted-foreground mt-1">Não é possível criar eventos no momento.</p>
        </div>
      ) : blocked ? (
        <div className="bg-nao/10 border border-destructive/30 rounded-xl p-4 text-center">
          <p className="text-sm text-destructive">
            Você está bloqueado até {new Date(rep!.blocked_until).toLocaleDateString("pt-BR")}.
          </p>
        </div>
      ) : (
        <GameCreateForm />
      )}
    </div>
  );
}
