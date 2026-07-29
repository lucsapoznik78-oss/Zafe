import type { Metadata } from "next";
import { LegalVersion } from "@/components/legal/LegalArchive";

export async function generateMetadata({
  params,
}: {
  params: { version: string };
}): Promise<Metadata> {
  return {
    title: `Política de Privacidade — versão ${params.version} | Zafe`,
    robots: { index: false, follow: true },
  };
}

export default function PoliticaVersaoPage({ params }: { params: { version: string } }) {
  return <LegalVersion doc="politica" version={params.version} />;
}
