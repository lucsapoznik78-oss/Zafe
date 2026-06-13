/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
