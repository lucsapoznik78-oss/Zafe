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

  const publicRoutes = ["/login", "/auth/callback", "/auth/confirm", "/historico", "/termos", "/jogo-responsavel", "/api/cron", "/api/push", "/api/concurso/pagamento/webhook", "/api/landing", "/r/", "/sitemap.xml", "/robots.txt", "/google", "/liga", "/ranking", "/u/", "/concurso", "/comunidade", "/copa", "/games", "/banido"];
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
  // A página de jogo responsável e sua API ficam fora do bloqueio de pausa,
  // senão um usuário em autoexclusão/cool-off entraria em loop de redirect e
  // não conseguiria ver o próprio status.
  const isPauseExempt =
    pathname.startsWith("/jogo-responsavel") || pathname.startsWith("/api/jogo-responsavel");

  if (authed && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, banned, self_excluded_until, cooloff_until, cpf")
      .eq("id", user?.id)
      .single();

    if (profile?.banned) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Conta suspensa" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/banido", request.url));
    }

    // Jogo responsável: autoexclusão ou pausa (cool-off) ativa bloqueia o
    // acesso ao produto até o prazo terminar.
    const now = Date.now();
    const pausaAtiva =
      (profile?.self_excluded_until && new Date(profile.self_excluded_until).getTime() > now) ||
      (profile?.cooloff_until && new Date(profile.cooloff_until).getTime() > now);
    if (pausaAtiva && !isPauseExempt) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Conta em pausa (jogo responsável)" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/jogo-responsavel", request.url));
    }

    if (
      (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
      !profile?.is_admin
    ) {
      return NextResponse.redirect(new URL("/liga", request.url));
    }

    // Cadastro incompleto: toda conta precisa de CPF (validado + único) antes de
    // usar o produto — vale para email/senha E Google. O CPF entra pela rota
    // autenticada /api/perfil/completar (nunca no user_metadata, migration 051).
    // Admins (founders/seed) ficam de fora pra não travarem o painel.
    const isCadastroGate =
      pathname.startsWith("/completar-cadastro") ||
      pathname.startsWith("/api/perfil/completar");
    if (!profile?.cpf && !profile?.is_admin && !isCadastroGate && !isPauseExempt) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Cadastro incompleto" }, { status: 403 });
      }
      const url = new URL("/completar-cadastro", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|txt|xml)$).*)",
  ],
};
