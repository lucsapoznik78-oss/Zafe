import type { Metadata } from "next";
import { LegalHistory } from "@/components/legal/LegalArchive";

export const metadata: Metadata = {
  title: "Histórico da Política de Privacidade | Zafe",
  description:
    "Todas as versões já publicadas da Política de Privacidade da Zafe, com data de vigência e resumo das mudanças.",
};

export default function HistoricoPoliticaPage() {
  return <LegalHistory doc="politica" />;
}
