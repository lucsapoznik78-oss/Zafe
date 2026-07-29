/**
 * Registro dos documentos legais — versão vigente de cada um.
 *
 * Este módulo é a fonte da verdade do que está VIGENTE, e é propositalmente
 * puro (sem imports) para poder ser lido também por Client Components. O
 * arquivo imutável das versões já publicadas fica em `legal_documents`, no
 * banco; a gravação e a leitura desse arquivo estão em `lib/legal-trail.ts`
 * (server-only).
 *
 * Ao publicar uma versão nova de um documento:
 *   1. edite a página (JSX);
 *   2. suba `version` e `effectiveFrom` aqui e escreva `changes`;
 *   3. depois do deploy, rode `node scripts/publicar-legal.mjs --base <prod>`.
 * Todo usuário com aceite em versão anterior passa pelo modal de re-aceite.
 */
export const LEGAL_DOCS = {
  termos: {
    label: "Termos de Uso",
    route: "/termos",
    version: "2026-07-29",
    effectiveFrom: "2026-07-29T00:00:00-03:00",
    changes: [
      "A Política de Privacidade passou a ser um documento próprio, em /politica.",
      "Removida a possibilidade de alteração unilateral dos termos: mudanças só valem para o futuro, com aviso de 30 dias, e nunca alteram edição do Concurso em andamento.",
      "Suspensão de conta agora exige comunicação do motivo, prazo de defesa de 15 dias e devolução da inscrição se a desclassificação não se confirmar.",
      "A taxa de inscrição do Concurso (R$ 20,00) passou a constar nos termos.",
      "Retirada a alíquota fixa de IRRF: a retenção segue a legislação tributária aplicável.",
    ],
  },
  politica: {
    label: "Política de Privacidade",
    route: "/politica",
    version: "2026-07-29",
    effectiveFrom: "2026-07-29T00:00:00-03:00",
    changes: [
      "Documento próprio, separado dos Termos de Uso.",
      "Bases legais declaradas por finalidade (LGPD art. 7º) e prazos de retenção explícitos.",
      "Transferência internacional de dados detalhada (Supabase, Vercel, Resend — LGPD arts. 33 a 36).",
      "Procedimento de incidente de segurança (LGPD art. 48) e Encarregado nomeado (LGPD art. 41).",
    ],
  },
  regulamento_concurso: {
    label: "Regulamento do Concurso",
    route: "/concurso/como-funciona",
    version: "2026-07-29",
    effectiveFrom: "2026-07-29T00:00:00-03:00",
    changes: [
      "A premiação é fixa e paga integralmente, independentemente do número de inscritos ou do valor arrecadado.",
      "Removida a regra de cancelamento da edição por número mínimo de inscritos.",
    ],
  },
} as const;

export type LegalDoc = keyof typeof LEGAL_DOCS;

/** Documentos que todo usuário precisa ter aceito para usar a plataforma. */
export const DOCS_OBRIGATORIOS: LegalDoc[] = ["termos", "politica"];

export type AcceptanceAction =
  | "signup"
  | "contest_entry"
  | "reaccept"
  | "contest_refunded";

export function ehLegalDoc(v: unknown): v is LegalDoc {
  return typeof v === "string" && v in LEGAL_DOCS;
}
