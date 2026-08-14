export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import CompletarCadastro from "@/components/auth/CompletarCadastro";
import ZafeLogo from "@/components/brand/Logo";
import { HOME_PATH } from "@/lib/flags";

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function CompletarCadastroPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // `cpf`/`birth_date` deixaram de ser legíveis com o client do usuário (audit
  // F-06: a policy de profiles é USING(true), então esse SELECT expunha a PII de
  // todos os usuários). O escopo aqui é o próprio `user.id`, vindo do getUser().
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("cpf, birth_date, full_name, username")
    .eq("id", user.id)
    .single();

  // Já tem CPF → cadastro completo, não precisa do gate.
  if (profile?.cpf) redirect(next && next.startsWith("/") ? next : HOME_PATH);

  const isGoogle = user.app_metadata?.provider === "google";
  // Nome do Google (metadata) > nome já salvo no perfil (desde que não seja o
  // username autogerado, que o trigger usa como fallback de full_name).
  const initialFullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (profile?.full_name && profile.full_name !== profile.username ? profile.full_name : "") ??
    "";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <ZafeLogo className="h-12 mx-auto" />
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
