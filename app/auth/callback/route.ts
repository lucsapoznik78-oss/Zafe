import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH } from "@/lib/flags";
import { recordSignupAcceptances } from "@/lib/legal-trail";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? HOME_PATH;
  const safeNext = next.startsWith("/") ? next : HOME_PATH;

  const redirectResponse = NextResponse.redirect(`${origin}${safeNext}`);

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Cadastro via Google: grava o aceite com IP e user-agent. É no-op quando a
    // conta não é recém-criada, ou seja, num login comum.
    if (data.user) {
      try {
        await recordSignupAcceptances(data.user.id, request);
      } catch (e) {
        console.error("[auth/callback] aceite", e);
      }
    }
  }

  return redirectResponse;
}
