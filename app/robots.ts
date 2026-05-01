import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe-rho.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/liga/", "/economico/", "/topicos/", "/ranking", "/u/", "/historico"],
        disallow: ["/admin/", "/perfil", "/apostas-privadas/", "/criar/", "/amigos/", "/portfolio/", "/notificacoes/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
