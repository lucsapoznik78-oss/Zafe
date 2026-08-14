// Content-Security-Policy — BLOQUEANTE (audit F-16).
// Ficou em Report-Only por um tempo, mas sem `report-uri` nenhum relatório era
// coletado em lugar nenhum, então a fase de observação nunca produziria dado e a
// política não protegia nada. Auditoria manual do que o browser carrega antes de
// virar a chave: nenhum iframe, nenhuma tag de terceiro (GTM/gtag), nenhum worker
// externo (só /sw.js, coberto por worker-src 'self'), e os hosts externos do
// repo (espn, pandascore, api-sports, resend, firecrawl, thesportsdb, wikidata)
// são todos chamados server-side pelos oráculos, não pelo browser. Os links de
// wa.me/twitter/instagram são navegação, que a CSP não restringe.
// 'unsafe-inline' em script-src é temporário: o Next injeta scripts inline no
// App Router; remover exige nonce via middleware.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://mhckuhqyyfoapzgrqeco.supabase.co wss://mhckuhqyyfoapzgrqeco.supabase.co https://va.vercel-scripts.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove o X-Powered-By: Next.js, que expõe stack e versão (F-16)
  poweredByHeader: false,
  eslint: {
    // ESLint não bloqueia o build na Vercel — lint é checado separadamente
    ignoreDuringBuilds: true,
  },
  // Host canônico único: tudo que não for www.zafe.app.br redireciona 301/308
  // para www, que é o host declarado em canonical/sitemap/robots/OG.
  //  - apex (zafe.app.br): servia 200 → site duplicado
  //  - *.vercel.app (zafe-rho.vercel.app e deploys): domínio padrão da Vercel
  //    indexado pelo Google como um terceiro site duplicado
  // Sem isso o Google via o site em vários hosts e adiava a indexação
  // ("Detectada, mas não indexada").
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "zafe.app.br" }],
        destination: "https://www.zafe.app.br/:path*",
        permanent: true,
      },
      // A regra do *.vercel.app só vale em produção. Em preview ela mandava o
      // deploy inteiro para www.zafe.app.br — não dava para abrir preview
      // nenhum, e como o 301 é permanente o navegador ainda guardava o desvio.
      // Preview não é indexado (fica atrás do SSO da Vercel), então não há
      // conteúdo duplicado a evitar aqui.
      ...(process.env.VERCEL_ENV === "preview"
        ? []
        : [
            {
              source: "/:path*",
              has: [{ type: "host", value: "(?<host>.*\\.vercel\\.app)" }],
              destination: "https://www.zafe.app.br/:path*",
              permanent: true,
            },
          ]),
      // Home vai direto pra Liga. Um `redirect()` em Server Component acaba
      // servido como RSC payload (funciona no browser, mas Googlebot pode não
      // seguir). Aqui vira 307 HTTP puro no edge da Vercel — cacheável e
      // interpretável por qualquer crawler. `permanent:false` de propósito:
      // se um dia voltar a landing, é só apagar esta linha (301 ficaria colado
      // no cache de browsers e no índice por meses).
      {
        source: "/",
        destination: "/liga",
        permanent: false,
      },
    ];
  },
  // Cabeçalhos de segurança (audit F-16). Antes só o HSTS existia.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // preload deixado de fora de propósito: entrar na preload list do
          // Chrome é praticamente irreversível (meses para sair). Adicionar só
          // como decisão consciente, depois de confirmar que todo subdomínio
          // serve HTTPS.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
