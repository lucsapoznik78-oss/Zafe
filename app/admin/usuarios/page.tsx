export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminUsuarios from "@/components/admin/AdminUsuarios";

export default async function AdminUsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/liga");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Carteiras, suspensão de contas, ajustes manuais de Z$ e monitoramento de
          jogo responsável (tempo de uso por semana, pausa e autoexclusão).
        </p>
      </div>
      <AdminUsuarios />
    </div>
  );
}
