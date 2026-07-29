import type { Metadata } from "next";
import { LegalHistory } from "@/components/legal/LegalArchive";

export const metadata: Metadata = {
  title: "Histórico dos Termos de Uso | Zafe",
  description: "Todas as versões já publicadas dos Termos de Uso da Zafe, com data de vigência e resumo das mudanças.",
};

export default function HistoricoTermosPage() {
  return <LegalHistory doc="termos" />;
}
