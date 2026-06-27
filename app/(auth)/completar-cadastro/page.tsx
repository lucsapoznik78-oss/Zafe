export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompletarCadastro from "@/components/auth/CompletarCadastro";

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function CompletarCadastroPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("cpf, birth_date, cep")
    .eq("id", user.id)
    .single();

  // Já tem CPF → cadastro completo, não precisa do gate.
  if (profile?.cpf) redirect(next && next.startsWith("/") ? next : "/inicio");

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/zafe-logo-full.png" alt="Zafe" className="h-12 mx-auto mb-3" />
          <p className="text-muted-foreground mt-2 text-sm">
            Falta pouco para completar seu cadastro
          </p>
        </div>
        <CompletarCadastro
          needsBirthDate={!profile?.birth_date}
          needsAddress={!profile?.cep}
          next={next}
        />
      </div>
    </div>
  );
}
