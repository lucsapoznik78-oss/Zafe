import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.zafe.app.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/", "/liga/", "/concurso", "/ranking", "/u/", "/historico", "/termos",
          "/politica", "/ajuda", "/jogo-responsavel", "/contato", "/paginas",
        ],
        // `/apostas-privadas/` saiu do disallow de propósito: virou stub de
        // redirect 308 para `/privadas/*`, e bloquear o crawl impede o Google
        // de ver o redirect e consolidar as URLs antigas.
        disallow: [
          "/admin/", "/perfil", "/privadas/",
          "/criar/", "/amigos/", "/portfolio/", "/notificacoes/",
          "/concurso/entrar", "/liga/criar", "/premium",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
