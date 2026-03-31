import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Zafe — Mercados de Previsão",
  description: "Invista em eventos reais com outros usuários. Plataforma brasileira de mercados de previsão.",
  robots: { index: false, follow: false },
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
