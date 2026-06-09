import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { liga_id } = await req.json();
  if (!liga_id) return NextResponse.json({ error: "liga_id obrigatório" }, { status: 400 });

  // Só o criador pode apagar o grupo
  const { data: liga } = await supabase
    .from("ligas")
    .select("creator_id")
    .eq("id", liga_id)
    .single();

  if (!liga) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
  if (liga.creator_id !== user.id) {
    return NextResponse.json({ error: "Apenas o criador pode apagar o grupo" }, { status: 403 });
  }

  // Delete cascateia liga_members e subgrupos; topics ficam com liga_id = NULL
  // (palpites preservados). Não há política RLS de DELETE em ligas, então usa
  // client admin após confirmar que o solicitante é o criador.
  const { error } = await createAdminClient().from("ligas").delete().eq("id", liga_id);

  if (error) return NextResponse.json({ error: "Erro ao apagar grupo" }, { status: 500 });

  return NextResponse.json({ success: true });
}
