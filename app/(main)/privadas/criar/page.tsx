export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreatePrivateBetForm from "@/components/apostas-privadas/CreatePrivateBetForm";

interface PageProps {
  searchParams: Promise<{ liga?: string }>;
}

export default async function CriarPrivadaPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Vindo de um grupo (?liga=): pré-carrega os membros ativos pra distribuir
  // entre juiz / SIM / NÃO. RLS garante que só membro lê os co-membros.
  const { liga: ligaId } = await searchParams;
  let ligaName: string | null = null;
  let ligaMembers: Array<{ id: string; username: string; full_name: string }> = [];
  if (ligaId) {
    const [{ data: liga }, { data: members }] = await Promise.all([
      supabase.from("ligas").select("name").eq("id", ligaId).single(),
      supabase
        .from("liga_members")
        .select("user_id, profiles(username, full_name)")
        .eq("liga_id", ligaId)
        .eq("status", "active"),
    ]);
    if (liga && members) {
      ligaName = liga.name;
      ligaMembers = members.map((m: any) => ({
        id: m.user_id,
        username: m.profiles?.username ?? "",
        full_name: m.profiles?.full_name ?? "",
      }));
    }
  }

  return (
    <div className="py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Novo Bolão</h1>
      <p className="text-muted-foreground text-sm mb-6">
        {ligaName
          ? `Bolão do grupo ${ligaName}: defina quem é juiz, quem palpita SIM e quem palpita NÃO.`
          : "Crie um bolão entre grupos. Número de juízes: 1, 3, 5 ou 7 (sempre ímpar)."}
      </p>
      <CreatePrivateBetForm userId={user.id} ligaName={ligaName} ligaMembers={ligaMembers} />
    </div>
  );
}
