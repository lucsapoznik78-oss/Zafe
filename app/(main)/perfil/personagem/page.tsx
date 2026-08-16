// Página inteira, não modal. O editor tem canvas 3D, duas abas e uma loja de
// 60 itens — dentro de um modal isso vira uma caixa de 400px com scroll duplo,
// e a ideia é que o usuário passe tempo aqui.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import EditorPersonagem from "@/components/figura3d/EditorPersonagem";
import { FIGURA_PADRAO } from "@/lib/figura/validar";
import { ehFiguraV2 } from "@/lib/figura/tipos";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export default async function PersonagemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [{ data: perfil }, { data: wallet }, { data: inventario }] = await Promise.all([
    admin.from("profiles").select("figura, figura_desbloqueada").eq("id", user.id).single(),
    supabase.from("wallets").select("balance").eq("user_id", user.id).single(),
    admin.from("figura_inventario").select("item_id").eq("user_id", user.id),
  ]);

  // A figura antiga (DiceBear) não tem `v` e não converte — ver ROLLBACK. Quem
  // vinha de lá começa do padrão, com a v1 preservada em `figura_legado`.
  const figura = ehFiguraV2(perfil?.figura) ? perfil.figura : FIGURA_PADRAO;

  return (
    <EditorPersonagem
      figuraInicial={figura}
      desbloqueada={perfil?.figura_desbloqueada ?? false}
      saldoInicial={Number(wallet?.balance ?? 0)}
      inventarioInicial={(inventario ?? []).map((r) => r.item_id as string)}
    />
  );
}
