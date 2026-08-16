import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CookieNotice from "@/components/layout/CookieNotice";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.zafe.app.br";

/**
 * O interruptor de cor. Ver app/globals.css e ROLLBACK.md.
 *
 *   NEXT_PUBLIC_THEME=legacy  → devolve o visual roxo/quase-preto inteiro
 *
 * Trocar o fallback abaixo tem o mesmo efeito, sem depender da Vercel.
 *
 * A cor da barra do navegador tem de ser o `--bg` de cada tema, chapada: este
 * valor vai numa <meta>, que o navegador lê antes de existir CSS.
 *
 * O FAVICON MORA EM `public/`, NÃO EM `app/`, E ISSO É DELIBERADO.
 *
 * `app/favicon.ico` é a única convenção de arquivo que o Next serve SEM hash de
 * versão: vira `<link rel="icon" href="/favicon.ico">`, enquanto `app/icon.svg`
 * sai como `/icon.svg?<hash>`. O banco de favicons do Chrome é indexado por URL,
 * então uma URL que nunca muda guarda o bitmap antigo para sempre — foi assim
 * que o Z roxo do tema legacy continuou na aba meses depois de o arquivo virar
 * grafite. Em `public/` o arquivo continua respondendo em `/favicon.ico` (é lá
 * que o buscador de ícones do Google vai bater), mas o `<link>` da página passa
 * a apontar só para o `/icon.svg?<hash>`, que é URL nova a cada troca de arte.
 * Não devolver `app/favicon.ico`, e não declarar `metadata.icons` à mão: a
 * precedência entre convenção de arquivo e config recria o link sem hash.
 */
const THEME_COLORS: Record<string, string> = {
  legacy:  "#0A0A0F",
  grafite: "#0F1012",
};
const PEDIDO = process.env.NEXT_PUBLIC_THEME ?? "";
const THEME = PEDIDO in THEME_COLORS ? PEDIDO : "grafite";
const THEME_COLOR = THEME_COLORS[THEME];

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Zafe — Fantasy Game de Previsões",
    template: "%s — Zafe",
  },
  // A DESCRIÇÃO NÃO PODE PROMETER O CONCURSO ENQUANTO ELE ESTIVER DESLIGADO.
  //
  // Estes textos são o que o Google mostra embaixo do link, e eles vendiam
  // "dispute o prêmio mensal" — o Concurso, que está atrás de
  // `CONCURSO_ENABLED = false` e cujo /concurso redireciona para a home. Quem
  // chegava pela busca vinha atrás de um prêmio em R$ que não existe e caía na
  // Liga. Enquanto a flag estiver desligada, a copy fala só da zona grátis.
  description: "O fantasy game de previsões do Brasil. Palpite no que vai acontecer no esporte, na economia e na política, receba Z$ grátis toda semana e suba no ranking dos melhores previsores.",
  keywords: ["zafe", "fantasy sport", "fantasy game", "liga de previsões", "ranking de previsões", "previsão esportiva", "e-sports", "brasil", "esportes", "competição de habilidade"],
  authors: [{ name: "Zafe" }],
  creator: "Zafe",
  publisher: "Zafe",
  verification: { google: "ea75690350d835b5" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: "website",
    url: APP_URL,
    locale: "pt_BR",
    siteName: "Zafe",
    title: "Zafe — Fantasy Game de Previsões",
    description: "O fantasy game de previsões do Brasil. Palpite em eventos reais, receba Z$ grátis toda semana e dispute o ranking.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zafe — Fantasy Game de Previsões",
    description: "O fantasy game de previsões do Brasil. Palpite em eventos reais, receba Z$ grátis toda semana e dispute o ranking.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zafe",
  },
};

// Next 14: viewport/themeColor têm export próprio — dentro de `metadata` são ignorados.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: "Zafe",
      alternateName: ["Zafe Liga", "Zafe App", "Zafe Previsões"],
      url: APP_URL,
      logo: {
        "@type": "ImageObject",
        url: `${APP_URL}/icon-512.png`,
        width: 512,
        height: 512,
      },
      image: `${APP_URL}/icon-512.png`,
      description:
        "Zafe é a liga de previsões do Brasil: uma competição de habilidade onde você compete prevendo o que vai acontecer, recebe Z$ grátis toda semana e disputa o ranking com os melhores previsores.",
      email: "contato@zafe.app",
      foundingDate: "2026",
      areaServed: { "@type": "Country", name: "Brasil" },
      knowsLanguage: "pt-BR",
      sameAs: [
        "https://www.wikidata.org/wiki/Q140214517",
        "https://www.instagram.com/zafe.app.br",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "Zafe",
      alternateName: "Zafe Liga",
      description: "A liga de previsões do Brasil",
      inLanguage: "pt-BR",
      publisher: { "@id": `${APP_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${APP_URL}/liga?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-theme={THEME} className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
