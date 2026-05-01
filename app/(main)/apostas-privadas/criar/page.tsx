export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreatePrivateBetForm from "@/components/apostas-privadas/CreatePrivateBetForm";

export default async function CriarApostaPrivadaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Nova Aposta Privada</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Crie uma aposta entre grupos. Número de juízes: 1, 3, 5 ou 7 (sempre ímpar).
      </p>
      <CreatePrivateBetForm userId={user.id} />
    </div>
  );
}
