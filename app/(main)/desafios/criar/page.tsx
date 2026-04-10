import CreateDesafioForm from "@/components/desafios/CreateDesafioForm";

export const metadata = { title: "Criar Desafio — Zafe" };

export default function CriarDesafioPage() {
  return (
    <div className="py-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Criar Desafio</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Crie um micro-mercado público sobre qualquer evento pessoal ou externo.
      </p>
      <CreateDesafioForm />
    </div>
  );
}
