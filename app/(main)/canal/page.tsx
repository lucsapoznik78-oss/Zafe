export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CanalUsuario from "@/components/canal/CanalUsuario";

export const metadata = {
  title: "Canal do Usuário | Zafe",
  description: "Fale direto com a equipe Zafe.",
};

export default async function CanalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="py-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white">Canal do Usuário</h1>
        <p className="text-sm text-muted-foreground">
          Sua linha direta com a equipe Zafe. Abra uma conversa e acompanhe a resposta por aqui.
        </p>
      </div>

      <Suspense fallback={null}>
        <CanalUsuario />
      </Suspense>
    </div>
  );
}
