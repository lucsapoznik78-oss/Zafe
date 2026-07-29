import type { Metadata } from "next";
import { LegalVersion } from "@/components/legal/LegalArchive";

export async function generateMetadata({
  params,
}: {
  params: { version: string };
}): Promise<Metadata> {
  return {
    title: `Regulamento do Concurso — versão ${params.version} | Zafe`,
    robots: { index: false, follow: true },
  };
}

export default function RegulamentoVersaoPage({ params }: { params: { version: string } }) {
  return <LegalVersion doc="regulamento_concurso" version={params.version} />;
}
