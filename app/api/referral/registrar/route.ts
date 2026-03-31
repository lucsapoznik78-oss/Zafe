import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });

  // Usuário atual já tem referral registrado?
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("referred_by, referral_code")
    .eq("id", user.id)
    .single();

  if (myProfile?.referred_by) {
    return NextResponse.json({ ok: true, already: true }); // silencioso, não é erro
  }

  // Encontrar o referenciador pelo código
  const { data: referrer } = await supabase
    .from("profiles")
    .select("id")
    .eq("referral_code", code.toUpperCase())
    .single();

  if (!referrer) return NextResponse.json({ error: "Código não encontrado" }, { status: 404 });
  if (referrer.id === user.id) return NextResponse.json({ error: "Não pode usar seu próprio código" }, { status: 400 });

  // Registrar referral
  await supabase.from("profiles").update({ referred_by: referrer.id }).eq("id", user.id);
  await supabase.from("referrals").insert({
    referrer_id: referrer.id,
    referred_id: user.id,
    status: "pending",
  });

  return NextResponse.json({ success: true });
}
