import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { executePalpitar } from "@/lib/apostar";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { side, amount } = await request.json();
  const res = await executePalpitar(supabase, user.id, params.id, side, amount);

  if (res.status === 200) {
    revalidatePath("/liga");
    revalidatePath(`/liga/${params.id}`);
    revalidatePath("/ranking");
    revalidatePath("/perfil");
  }

  return res;
}
