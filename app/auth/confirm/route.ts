import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/inicio";
  const safeNext = next.startsWith("/") ? next : "/inicio";

  const errorRedirect = NextResponse.redirect(`${origin}/login?error=auth_failed`);

  if (!token_hash || !type) return errorRedirect;

  // Cria a response de sucesso primeiro — cookies da sessão são setados nela diretamente
  const successRedirect = NextResponse.redirect(`${origin}${safeNext}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Seta os cookies da sessão direto na response de redirect
          cookiesToSet.forEach(({ name, value, options }) =>
            successRedirect.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: type as "signup" | "email_change" | "recovery" | "invite" | "magiclink",
  });

  if (!error) return successRedirect;

  return errorRedirect;
}
