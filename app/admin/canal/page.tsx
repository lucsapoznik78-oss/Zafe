export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminCanal from "@/components/admin/AdminCanal";

export default async function AdminCanalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/liga");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-foreground">Canal do Usuário</h1>
        <p className="text-sm text-muted-foreground">
          Mensagens enviadas pelos usuários em /canal. Responda por aqui — o usuário
          recebe notificação no app e push.
        </p>
      </div>
      <AdminCanal />
    </div>
  );
}
