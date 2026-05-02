import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zafe-rho.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Zafe — A liga das previsões",
    template: "%s — Zafe",
  },
  description: "Compete prevendo o que vai acontecer. Receba 1.000 Z$ grátis ao criar conta e dispute o prêmio mensal com os melhores previsores do Brasil.",
  keywords: ["liga de previsões", "concurso de previsões", "previsão esportiva", "brasil", "política", "esportes", "economia", "competição de habilidade"],
  authors: [{ name: "Zafe" }],
  verification: { google: "ea75690350d835b5" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Zafe",
    title: "Zafe — A liga das previsões",
    description: "Compete prevendo o que vai acontecer. Prêmio mensal em PIX pros melhores.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zafe — A liga das previsões",
    description: "Compete prevendo o que vai acontecer. Prêmio mensal em PIX pros melhores.",
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
