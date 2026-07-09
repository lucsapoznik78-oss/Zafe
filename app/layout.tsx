import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.zafe.app.br";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Zafe — Fantasy Game de Previsões",
    template: "%s — Zafe",
  },
  description: "O fantasy game de previsões do Brasil. Compete prevendo eventos reais, receba Z$ grátis e dispute o prêmio mensal com os melhores previsores.",
  keywords: ["zafe", "fantasy sport", "fantasy game", "liga de previsões", "concurso de previsões", "previsão esportiva", "e-sports", "brasil", "esportes", "competição de habilidade"],
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
    description: "O fantasy game de previsões do Brasil. Compete, ganhe Z$ grátis e dispute o prêmio mensal.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zafe — Fantasy Game de Previsões",
    description: "O fantasy game de previsões do Brasil. Compete, ganhe Z$ grátis e dispute o prêmio mensal.",
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
  themeColor: "#0A0A0F",
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
        "Zafe é a liga de previsões do Brasil: uma competição de habilidade onde você compete prevendo o que vai acontecer, recebe Z$ grátis e dispute o prêmio mensal com os melhores previsores.",
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
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased bg-background text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
