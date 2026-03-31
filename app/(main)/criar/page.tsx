export const dynamic = "force-dynamic";
import CreateTopicForm from "@/components/topicos/CreateTopicForm";

export default function CriarPage() {
  return (
    <div className="py-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Criar Novo Investimento</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Proponha um tópico para a comunidade apostar</p>
      </div>
      <CreateTopicForm />
    </div>
  );
}
