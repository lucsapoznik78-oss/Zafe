import type { MetadataRoute } from "next";
import { CONCURSO_ENABLED } from "@/lib/flags";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.zafe.app.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // `/concurso` sai do allow com a flag, mas NÃO entra no disallow: com o
        // Concurso desligado a rota devolve 308 para a home, e bloquear o crawl
        // impediria o Google de ver esse redirect — a URL ficaria indexada para
        // sempre, que é exatamente o problema que se quer resolver. Ele precisa
        // entrar para ler a placa de mudança.
        allow: [
          "/", "/liga/", ...(CONCURSO_ENABLED ? ["/concurso"] : []), "/ranking",
          "/u/", "/historico", "/termos",
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
