import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { executeCommunityBet } from "@/lib/comunidade";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { side, amount } = await request.json();
  const admin = createAdminClient();
  const result = await executeCommunityBet(admin, user.id, params.id, side, amount);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Um palpite pode tornar o evento "de dois lados". Invalida a lista e a página
  // do evento no servidor — router.refresh() do cliente só cobre a rota atual,
  // deixando o card da lista preso no estado antigo ("aguardando outro lado").
  revalidatePath("/comunidade");
  revalidatePath(`/comunidade/${params.id}`);

  return NextResponse.json(result);
}
