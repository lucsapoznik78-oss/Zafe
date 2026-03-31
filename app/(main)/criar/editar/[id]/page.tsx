export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import EditTopicForm from "@/components/topicos/EditTopicForm";

interface PageProps { params: Promise<{ id: string }> }

export default async function EditarTopicoPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: topic } = await supabase
    .from("topics")
    .select("id, title, description, category, closes_at, status, creator_id")
    .eq("id", id)
    .single();

  if (!topic) notFound();
  if (topic.creator_id !== user.id || topic.status !== "pending") {
    redirect("/meus-topicos");
  }

  return (
    <div className="py-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Editar Tópico</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Aguardando aprovação — você ainda pode editar</p>
      </div>
      <EditTopicForm topic={topic} />
    </div>
  );
}
