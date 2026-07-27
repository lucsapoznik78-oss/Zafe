// Content-Security-Policy — publicada em Report-Only primeiro (audit F-16).
// Só depois de alguns dias sem violação no relatório ela vira bloqueante
// (trocar a chave para "Content-Security-Policy" abaixo).
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
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<host>.*\\.vercel\\.app)" }],
        destination: "https://www.zafe.app.br/:path*",
        permanent: true,
      },
    ];
  },
  // Cabeçalhos de segurança (audit F-16). Antes só o HSTS existia.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
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
