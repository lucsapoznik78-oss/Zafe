import type { Metadata } from "next";
import { LegalVersion } from "@/components/legal/LegalArchive";

export async function generateMetadata({
  params,
}: {
  params: { version: string };
}): Promise<Metadata> {
  return {
    title: `Termos de Uso — versão ${params.version} | Zafe`,
    robots: { index: false, follow: true },
  };
}

export default function TermosVersaoPage({ params }: { params: { version: string } }) {
  return <LegalVersion doc="termos" version={params.version} />;
}
