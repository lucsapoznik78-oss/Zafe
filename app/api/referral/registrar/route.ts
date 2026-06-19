import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/referral/registrar — registra a indicação a partir do código do
// cookie zafe_ref (setado por /r/[code]). Um mesmo código pode ser:
//  * de AMIGO (profiles.referral_code) → grava profiles.referred_by + referrals
//  * de STREAMER (games_streamers.code) → grava games_referrals (atribuição
//    do programa de streamers da Zafe Games), com sinais anti-fraude.
// As duas atribuições são independentes e não se bloqueiam.

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const admin = createAdminClient();

  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const codeUpper = String(code).toUpperCase();

  // ── Indicação de AMIGO (sistema existente) ──────────────────────────
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", user.id)
    .single();

  if (!myProfile?.referred_by) {
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", codeUpper)
      .single();

    if (referrer && referrer.id !== user.id) {
      await admin.from("profiles").update({ referred_by: referrer.id }).eq("id", user.id);
      await admin.from("referrals").insert({
        referrer_id: referrer.id,
        referred_id: user.id,
        status: "pending",
      });
    }
  }

  // ── Atribuição de STREAMER (Zafe Games) ─────────────────────────────
  // Anti-fraude: sem auto-indicação; 1 atribuição por usuário (UNIQUE);
  // conta duplicada (mesmo IP já atribuído ao streamer) entra 'rejected'.
  const { data: streamer } = await admin
    .from("games_streamers")
    .select("id, user_id, status")
    .eq("code", codeUpper)
    .maybeSingle();

  if (streamer && streamer.status === "active" && streamer.user_id !== user.id) {
    const { data: already } = await admin
      .from("games_referrals")
      .select("id")
      .eq("referred_user_id", user.id)
      .maybeSingle();

    if (!already) {
      const ip = clientIp(request);
      const device = request.headers.get("user-agent")?.slice(0, 200) ?? null;

      // Sinal anti-fraude: mesmo IP já confirmado/pendente para este streamer.
      let status: "pending" | "rejected" = "pending";
      if (ip) {
        const { data: dup } = await admin
          .from("games_referrals")
          .select("id")
          .eq("streamer_id", streamer.id)
          .eq("signup_ip", ip)
          .limit(1);
        if (dup && dup.length > 0) status = "rejected";
      }

      await admin.from("games_referrals").insert({
        streamer_id: streamer.id,
        referred_user_id: user.id,
        status,
        signup_ip: ip,
        signup_device: device,
      });
    }
  }

  return NextResponse.json({ success: true });
}
