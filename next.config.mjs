/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ESLint não bloqueia o build na Vercel — lint é checado separadamente
    ignoreDuringBuilds: true,
  },
  // Host canônico único: o apex (zafe.app.br) redireciona 301 para www, que é
  // o host declarado em canonical/sitemap/robots/OG. Sem isso, os dois hosts
  // serviam 200 → Google via o site inteiro duplicado e adiava a indexação
  // ("Detectada, mas não indexada").
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "zafe.app.br" }],
        destination: "https://www.zafe.app.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
