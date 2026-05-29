import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.zafe.app.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/liga/", "/economico/", "/ranking", "/u/", "/historico", "/termos"],
        disallow: [
          "/admin/", "/perfil", "/apostas-privadas/", "/privadas/",
          "/criar/", "/amigos/", "/portfolio/", "/notificacoes/",
          "/concurso/entrar", "/liga/criar", "/premium",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
