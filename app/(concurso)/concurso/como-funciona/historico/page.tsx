import type { Metadata } from "next";
import { LegalHistory } from "@/components/legal/LegalArchive";

export const metadata: Metadata = {
  title: "Histórico do Regulamento do Concurso | Zafe",
  description:
    "Todas as versões já publicadas do Regulamento do Concurso Zafe, com data de vigência e resumo das mudanças.",
};

export default function HistoricoRegulamentoPage() {
  return <LegalHistory doc="regulamento_concurso" />;
}
