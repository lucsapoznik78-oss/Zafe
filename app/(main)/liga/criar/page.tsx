export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CreateTopicForm from "@/components/topicos/CreateTopicForm";

export const metadata = { title: "Criar Setor — Zafe" };

export default async function CriarLigaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="py-6 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Criar Setor</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Proponha um evento para a comunidade palpitar
        </p>
      </div>
      <CreateTopicForm excludeCategories={["economia"]} />
    </div>
  );
}
