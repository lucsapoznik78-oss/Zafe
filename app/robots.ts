import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/topicos/", "/ranking", "/u/"],
        disallow: ["/admin/", "/perfil", "/depositar", "/apostas-privadas/", "/criar/"],
      },
    ],
    sitemap: "https://zafe.com.br/sitemap.xml",
  };
}
