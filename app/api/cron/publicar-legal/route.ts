import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { ensureLegalDocument } from "@/lib/legal-trail";

/**
 * Arquiva em `legal_documents` a versão vigente de cada documento legal, com o
 * texto integral renderizado e o SHA-256 dele.
 *
 * Roda depois de cada deploy (`scripts/publicar-legal.mjs`). É idempotente: um
 * documento já arquivado não é tocado — se o texto mudou, o correto é subir a
 * versão em `lib/legal.ts`, nunca reescrever a linha antiga (a tabela é
 * append-only por trigger).
 *
 * Vive sob /api/cron para herdar a autenticação por CRON_SECRET; não está no
 * vercel.json porque o gatilho é o deploy, não o relógio.
 */
export async function POST(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const resultados = [];

  for (const doc of Object.keys(LEGAL_DOCS) as LegalDoc[]) {
    try {
      const { version, hash, criado } = await ensureLegalDocument(doc, origin);
      resultados.push({ document: doc, version, hash, status: criado ? "criado" : "já arquivado" });
    } catch (e) {
      resultados.push({ document: doc, status: "erro", erro: (e as Error).message });
    }
  }

  const falhou = resultados.some((r) => r.status === "erro");
  return NextResponse.json({ ok: !falhou, resultados }, { status: falhou ? 500 : 200 });
}
