import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehLegalDoc } from "@/lib/legal";
import { pendingReacceptances, recordAcceptance } from "@/lib/legal-trail";

/**
 * Aceite expresso de uma nova versão dos documentos legais (modal de re-aceite).
 *
 * O corpo diz o que o usuário clicou, mas quem manda é o servidor: só documentos
 * que estão de fato pendentes para ESTE usuário são gravados. Assim um POST
 * forjado não consegue registrar aceite de coisa nenhuma.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pedidos: unknown = body?.documents;
  if (!Array.isArray(pedidos) || !pedidos.every(ehLegalDoc)) {
    return NextResponse.json({ error: "Documentos inválidos" }, { status: 400 });
  }

  const pendentes = await pendingReacceptances(user.id);
  const aGravar = pendentes.filter((p) => pedidos.includes(p.document));

  for (const p of aGravar) {
    await recordAcceptance({
      userId: user.id,
      document: p.document,
      action: "reaccept",
      req: request,
    });
  }

  const restantes = pendentes
    .filter((p) => !pedidos.includes(p.document))
    .map((p) => p.document);

  return NextResponse.json({ aceitos: aGravar.map((p) => p.document), restantes });
}
