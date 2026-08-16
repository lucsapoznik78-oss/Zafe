import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { CONCURSO_ENABLED, CONCURSO_INSCRICOES_ABERTAS, HOME_PATH, PREMIUM_ENABLED } from "@/lib/flags";
import { LEGAL_DOCS } from "@/lib/legal";
import { checkRateLimit, policyFor, registrarBloqueio } from "@/lib/ratelimit";
import { rateLimitDesligado } from "@/lib/killswitch";

// Primeiro segmento de cada rota que realmente existe em `app/` (incluindo os
// route groups). Usado só para distinguir URL inexistente de rota protegida —
// ver o bloco de soft-404 mais abaixo. Ao criar uma pasta nova em `app/`,
// acrescente o segmento aqui, senão a página passa a devolver 404.
const ROTAS_CONHECIDAS = new Set([
  "admin", "ajuda", "amigos", "api", "apostas-privadas", "auth", "banido",
  "canal", "completar-cadastro", "comunidade", "concurso", "contato", "criar",
  "escalacao", "games", "historico", "inicio", "jogo-responsavel", "liga",
  "ligas", "login",
  "meus-topicos", "paginas", "perfil", "politica", "portfolio", "premium",
  "privadas", "r", "ranking", "redefinir-senha", "termos", "topicos", "u",
]);

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  // Kill switch: com o Concurso desligado ninguém acessa o mundo pago direto por
  // link/anúncio. As páginas /concurso vão pra home; a API /api/concurso segue
  // fora daqui (prefixo diferente) e é inócua enquanto o PIX não está configurado.
  //
  // 308 E NÃO 307, DE PROPÓSITO. Redirect temporário diz ao Google "a página
  // continua sendo essa, volte depois" — e ele mantém /concurso no índice. Era
  // por isso que buscar "zafe" ainda trazia o Concurso, um resultado que leva a
  // lugar nenhum. Permanente é o único status que faz o índice consolidar em /.
  //
  // O `no-store` é o que torna o 308 reversível: navegador cacheia redirect
  // permanente por tempo indefinido, então sem ele, no dia em que a flag ligar,
  // quem já tentou /concurso uma vez nunca mais chegaria lá — sem nada no
  // servidor para consertar. Sem cache, só o índice do Google fica permanente.
  if (!CONCURSO_ENABLED && request.nextUrl.pathname.startsWith("/concurso")) {
    const fora = NextResponse.redirect(new URL("/", request.url), 308);
    fora.headers.set("Cache-Control", "no-store");
    return fora;
  }

  // Mesma lógica pro Premium: enquanto a cobrança e o feature-set não estão
  // prontos, /premium não pode ser acessado nem por link direto.
  if (!PREMIUM_ENABLED && request.nextUrl.pathname.startsWith("/premium")) {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
  }

  // Server Components não enxergam o pathname. O gate de re-aceite precisa dele
  // para não se montar em cima das próprias páginas legais — senão o modal
  // bloqueia justamente o texto que ele pede para o usuário ler.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const nextRequest = { headers: requestHeaders };

  let supabaseResponse = NextResponse.next({ request: nextRequest });

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
          supabaseResponse = NextResponse.next({ request: nextRequest });
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

  // Rate limit (Camada 2). Fica depois do getUser() para poder usar a conta
  // como chave — IP é fallback só onde ainda não há sessão. Antes dos gates de
  // auth/ban/pausa porque o custo de uma varredura não deve depender de o
  // atacante estar logado ou não.
  // A ordem dos dois testes importa: `policyFor` é regex pura e roda primeiro,
  // então a leitura do kill switch só acontece nas poucas rotas que têm
  // política — uma navegação comum nunca paga por ela.
  const policy = policyFor(pathname);
  if (policy && !(await rateLimitDesligado())) {
    const identifier = user ? `user:${user.id}` : `ip:${request.ip ?? "desconhecido"}`;
    const rl = await checkRateLimit(policy, identifier);
    if (!rl.ok) {
      const unavailable = rl.reason === "unavailable";
      // O `identifier` NÃO entra no log. IP é dado pessoal (LGPD art. 5º, II) e
      // `user:<uuid>` é diretamente identificável; o log da Vercel é visível a
      // quem tiver acesso ao projeto e seria repassado literalmente a qualquer
      // drain futuro. `tipoChave` guarda o único bit que importa para triagem:
      // tráfego pré-auth ou de conta logada.
      const linha = JSON.stringify({
        evt: "ratelimit",
        motivo: rl.reason,
        policy: policy.prefix,
        rota: pathname,
        tipoChave: user ? "user" : "ip",
        limite: policy.limit,
        janela: policy.window,
        retryAfter: unavailable ? 30 : rl.retryAfter,
        ts: new Date().toISOString(),
      });
      // `unavailable` é incidente (o Redis caiu e escritas de dinheiro estão
      // sendo recusadas); `limited` é o sistema funcionando como projetado.
      if (unavailable) console.error(linha);
      else console.warn(linha);

      const contagem = registrarBloqueio(policy.prefix, rl.reason);
      if (contagem) event.waitUntil(contagem);

      if (unavailable) {
        return NextResponse.json(
          { error: "Serviço temporariamente indisponível. Tente novamente em instantes." },
          { status: 503, headers: { "Retry-After": "30" } }
        );
      }
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento e tente de novo." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }
    // A escrita do contador não precisa segurar a resposta.
    if (rl.pending) event.waitUntil(rl.pending);
  }

  const publicRoutes = ["/login", "/auth/callback", "/auth/confirm", "/api/auth/username", "/api/auth/email-exists", "/api/auth/2fa-contexto", "/historico", "/termos", "/politica", "/ajuda", "/jogo-responsavel", "/contato", "/paginas", "/apostas-privadas", "/api/cron", "/api/push", "/api/concurso/pagamento/webhook", "/api/landing", "/r/", "/sitemap.xml", "/robots.txt", "/google", "/liga", "/ranking", "/u/", "/concurso", "/comunidade", "/games", "/escalacao", "/banido"];
  // `/apostas-privadas/*` entra em publicRoutes só porque virou stub de
  // redirect 308 para `/privadas/*`: se continuasse protegida, o crawler
  // levaria 307 para /login e nunca veria o sinal de consolidação. O destino
  // (`/privadas/*`) segue exigindo login normalmente.
  const isPublicRoute = pathname === "/" || publicRoutes.some((r) => pathname.startsWith(r));

  // Soft-404: sem isto, QUALQUER URL inexistente cai no redirect para /login
  // abaixo e devolve 200 com a tela de login. Para o Google isso é uma página
  // válida — o site inteiro vira conteúdo duplicado e as URLs lixo entram no
  // índice. Rota desconhecida agora passa direto e o Next renderiza
  // `app/not-found.tsx` com 404 de verdade.
  const primeiroSegmento = pathname.split("/")[1] ?? "";
  if (primeiroSegmento && !ROTAS_CONHECIDAS.has(primeiroSegmento)) {
    return NextResponse.next({ request: nextRequest });
  }

  // Email não confirmado (signups por senha) conta como não autenticado para
  // rotas protegidas. Logins via OAuth (Google) já vêm com email_confirmed_at.
  const emailVerified = !!user?.email_confirmed_at;
  const authed = !!user && emailVerified;

  if (!authed && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
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
      // `has_cpf` (coluna gerada, migration 065) em vez do `cpf` em si: a policy
      // de leitura de profiles é USING(true), então o SELECT de `cpf` para
      // `authenticated` vazava o CPF de todos os usuários (audit F-06).
      .select("is_admin, banned, self_excluded_until, cooloff_until, has_cpf")
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

    // Cadastro incompleto: o CPF (validado + único) só é OBRIGATÓRIO quando o
    // Concurso realmente aceita inscrição com prêmio R$ em jogo. Enquanto é
    // pré-lançamento (mesmo com a UI do Concurso visível pra divulgação), a
    // zona grátis é 100% Z$ virtual e não precisa de CPF — ninguém é travado
    // nesse muro só para navegar/prever de graça. O CPF entra pela rota
    // autenticada /api/perfil/completar (nunca no user_metadata, migration 051).
    // Admins (founders/seed) ficam de fora pra não travarem o painel.
    const isCadastroGate =
      pathname.startsWith("/completar-cadastro") ||
      pathname.startsWith("/api/perfil/completar");
    if (CONCURSO_INSCRICOES_ABERTAS && !profile?.has_cpf && !profile?.is_admin && !isCadastroGate && !isPauseExempt) {
      if (pathname.startsWith("/api")) {
        return NextResponse.json({ error: "Cadastro incompleto" }, { status: 403 });
      }
      const url = new URL("/completar-cadastro", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Versão vigente do documento legal servido nesta rota. Permite verificar de
  // fora (curl / auditoria) qual texto estava no ar em determinada data, sem
  // depender do HTML.
  const docVigente = Object.values(LEGAL_DOCS).find((d) => d.route === pathname);
  if (docVigente) {
    supabaseResponse.headers.set("X-Document-Version", docVigente.version);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|txt|xml)$).*)",
  ],
};
