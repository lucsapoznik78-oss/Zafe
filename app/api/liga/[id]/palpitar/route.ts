import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { executePalpitar } from "@/lib/apostar";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { side, amount } = await request.json();
  // executePalpitar escreve em wallets/bets/transactions, que passaram a ser
  // service-role-only (audit F-01/F-07/F-08). A identidade já foi verificada
  // acima e `user.id` é passado explicitamente — não vem do corpo da request.
  const res = await executePalpitar(createAdminClient(), user.id, params.id, side, amount);

  if (res.status === 200) {
    revalidatePath("/liga");
    revalidatePath(`/liga/${params.id}`);
    revalidatePath("/ranking");
    revalidatePath("/perfil");
  }

  return res;
}
