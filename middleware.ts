import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const publicRoutes = ["/login", "/auth/callback", "/auth/confirm", "/historico", "/termos", "/api/cron", "/api/push", "/api/concurso/pagamento/webhook", "/r/", "/sitemap.xml", "/robots.txt", "/google", "/liga", "/ranking", "/u/", "/concurso", "/comunidade", "/copa", "/games", "/banido"];
  const isPublicRoute = pathname === "/" || publicRoutes.some((r) => pathname.startsWith(r));

  // Email não confirmado (signups por senha) conta como não autenticado para
  // rotas protegidas. Logins via OAuth (Google) já vêm com email_confirmed_at.
  const emailVerified = !!user?.email_confirmed_at;
  const authed = !!user && emailVerified;

  if (!authed && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  // Rotas protegidas: uma única leitura do perfil cobre o gate de admin e o
  // bloqueio de contas banidas (audit #21). Rotas públicas (somente leitura)
  // ficam fora para não custar uma query por navegação.
  if (authed && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, banned")
      .eq("id", user?.id)
      .single();

    if (profile?.banned) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Conta suspensa" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/banido", request.url));
    }

    if (
      (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
      !profile?.is_admin
    ) {
      return NextResponse.redirect(new URL("/liga", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|txt|xml)$).*)",
  ],
};
