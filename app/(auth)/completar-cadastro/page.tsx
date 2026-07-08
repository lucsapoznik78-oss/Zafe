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
    .select("cpf, birth_date, full_name, username")
    .eq("id", user.id)
    .single();

  // Já tem CPF → cadastro completo, não precisa do gate.
  if (profile?.cpf) redirect(next && next.startsWith("/") ? next : "/inicio");

  const isGoogle = user.app_metadata?.provider === "google";
  // Nome do Google (metadata) > nome já salvo no perfil (desde que não seja o
  // username autogerado, que o trigger usa como fallback de full_name).
  const initialFullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (profile?.full_name && profile.full_name !== profile.username ? profile.full_name : "") ??
    "";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/zafe-logo-full.png" alt="Zafe" className="h-12 mx-auto" />
        </div>
        <CompletarCadastro
          isGoogle={isGoogle}
          email={user.email ?? ""}
          initialFullName={initialFullName}
          needsBirthDate={!profile?.birth_date}
          next={next}
        />
      </div>
    </div>
  );
}
