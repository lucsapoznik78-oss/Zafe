import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { LEGAL_DOCS } from "@/lib/legal";
import { pendingReacceptances } from "@/lib/legal-trail";
import ReaceiteModal from "./ReaceiteModal";

/**
 * Monta o modal de re-aceite quando há documento vigente mais novo que o último
 * aceito pelo usuário.
 *
 * Fica no layout, não no middleware: metade do app é rota pública (SEO) e o
 * middleware só lê o perfil nas rotas protegidas, então um gate lá deixaria o
 * usuário logado navegando por /liga, /ranking e /concurso sem nunca ver o
 * modal. Aqui a fonte da verdade é o banco, então várias abas veem o mesmo
 * estado e fechar a aba não "resolve" a pendência.
 */
export default async function ReaceiteGate() {
  // As próprias páginas legais ficam de fora: o modal manda ler o documento, e
  // seria absurdo ele cobrir o documento. Vale para o histórico e as versões
  // arquivadas também, daí o startsWith.
  const pathname = headers().get("x-pathname") ?? "";
  if (Object.values(LEGAL_DOCS).some((d) => pathname.startsWith(d.route))) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) return null;

  const pendentes = await pendingReacceptances(user.id);
  if (pendentes.length === 0) return null;

  return <ReaceiteModal pendentes={pendentes} />;
}
