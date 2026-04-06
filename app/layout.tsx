import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Zafe — Mercados de Previsão do Brasil",
    template: "%s — Zafe",
  },
  description: "Aposte em eventos políticos, esportivos e econômicos com outros usuários. O primeiro prediction market brasileiro.",
  keywords: ["prediction market", "mercado de previsão", "apostas", "brasil", "política", "esportes", "economia"],
  authors: [{ name: "Zafe" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Zafe",
    title: "Zafe — Mercados de Previsão do Brasil",
    description: "Aposte em eventos políticos, esportivos e econômicos com outros usuários.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zafe — Mercados de Previsão do Brasil",
    description: "Aposte em eventos políticos, esportivos e econômicos com outros usuários.",
  },
  manifest: "/manifest.json",
  themeColor: "#86efac",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zafe",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="antialiased bg-black text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
