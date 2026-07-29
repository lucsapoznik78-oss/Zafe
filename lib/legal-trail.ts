import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import {
  LEGAL_DOCS,
  DOCS_OBRIGATORIOS,
  type LegalDoc,
  type AcceptanceAction,
} from "@/lib/legal";

/**
 * Arquivamento das versões publicadas e trilha probatória do aceite.
 * Server-only (usa o service role). O registro do que está vigente fica em
 * `lib/legal.ts`.
 */

// ── Arquivamento ──────────────────────────────────────────────────

/**
 * Texto normalizado do documento: só o conteúdo marcado com `data-legal-doc`,
 * sem tags, com espaços colapsados. É sobre ESTA string que o SHA-256 é
 * calculado, então ela precisa ser estável entre builds — daí a marcação
 * explícita no JSX, em vez de um seletor genérico como <main>.
 */
function extrairTexto(html: string, doc: LegalDoc): string | null {
  const inicio = html.indexOf(`data-legal-doc="${doc}"`);
  if (inicio === -1) return null;

  const abreFim = html.indexOf(">", inicio);
  if (abreFim === -1) return null;

  // Do fim da tag de abertura até o </div> que fecha o container. O conteúdo é
  // uma árvore de <div>/<section>, então basta contar a profundidade das <div>.
  let i = abreFim + 1;
  let profundidade = 1;
  while (profundidade > 0) {
    const proxAbre = html.indexOf("<div", i);
    const proxFecha = html.indexOf("</div>", i);
    if (proxFecha === -1) return null;
    if (proxAbre !== -1 && proxAbre < proxFecha) {
      profundidade++;
      i = proxAbre + 4;
    } else {
      profundidade--;
      i = proxFecha + 6;
    }
  }

  return html
    .slice(abreFim + 1, i - 6)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&(?:#\d+|#x[0-9a-fA-F]+|\w+);/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashDocumento(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/**
 * Garante que a versão vigente de `doc` está arquivada em `legal_documents`,
 * buscando a própria página e guardando texto + hash.
 *
 * Auto-curativo de propósito: é chamado pelo script de publicação E por
 * `recordAcceptance`. Assim a ordem "deploy → rodar script" deixa de ser um
 * ponto de falha — o primeiro aceite depois de um deploy arquiva a versão.
 */
export async function ensureLegalDocument(
  doc: LegalDoc,
  origin: string
): Promise<{ version: string; hash: string; criado: boolean }> {
  const meta = LEGAL_DOCS[doc];
  const admin = createAdminClient();

  const { data: existente } = await admin
    .from("legal_documents")
    .select("document_hash")
    .eq("document", doc)
    .eq("version", meta.version)
    .maybeSingle();

  if (existente) {
    return { version: meta.version, hash: existente.document_hash, criado: false };
  }

  const res = await fetch(`${origin}${meta.route}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Falha ao buscar ${meta.route} para arquivar: HTTP ${res.status}`);
  }
  const texto = extrairTexto(await res.text(), doc);
  if (!texto) {
    throw new Error(`Marcador data-legal-doc="${doc}" não encontrado em ${meta.route}`);
  }

  const hash = hashDocumento(texto);
  const { error } = await admin.from("legal_documents").insert({
    document: doc,
    version: meta.version,
    document_hash: hash,
    effective_from: meta.effectiveFrom,
    summary_of_changes: meta.changes.join("\n"),
    content_md: texto,
  });

  // 23505 = corrida com outro request que arquivou a mesma versão primeiro.
  if (error && error.code !== "23505") throw error;

  return { version: meta.version, hash, criado: !error };
}

// ── Trilha de aceite ──────────────────────────────────────────────

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || null;
  return req.headers.get("x-real-ip");
}

/**
 * Grava o ato de aceite. Idempotente: os índices únicos cobrem (usuário,
 * documento, versão, ato) para signup/reaccept e (usuário, documento, edição)
 * para contest_entry, então retries e abas duplicadas não geram linha nova.
 */
export async function recordAcceptance({
  userId,
  document,
  action,
  req,
  origin,
  contestEdition = null,
  metadata = null,
}: {
  userId: string;
  document: LegalDoc;
  action: AcceptanceAction;
  /**
   * Request do próprio usuário, de onde saem IP e user-agent. Ausente quando o
   * ato não chega por um request dele — o webhook do PIX, por exemplo, vem do
   * provedor, e gravar o IP do provedor seria prova falsa.
   */
  req?: Request;
  origin?: string;
  contestEdition?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const base = origin ?? (req ? new URL(req.url).origin : null);
  if (!base) throw new Error("recordAcceptance precisa de `req` ou `origin`");
  const { version, hash } = await ensureLegalDocument(document, base);

  const admin = createAdminClient();
  const { error } = await admin.from("terms_acceptances").insert({
    user_id: userId,
    document,
    version,
    document_hash: hash,
    action,
    ip: req ? clientIp(req) : null,
    user_agent: req?.headers.get("user-agent") ?? null,
    contest_edition: contestEdition,
    metadata,
  });

  if (error && error.code !== "23505") throw error;
  return { version, hash };
}

export type PendenciaLegal = {
  document: LegalDoc;
  label: string;
  route: string;
  version: string;
  effectiveFrom: string;
  changes: readonly string[];
};

/**
 * Documentos cuja versão vigente é mais nova que a última aceita pelo usuário.
 * Quem nunca aceitou nada (contas anteriores a esta trilha) aparece aqui — o
 * modal de re-aceite cuida delas.
 */
export async function pendingReacceptances(userId: string): Promise<PendenciaLegal[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("terms_acceptances")
    .select("document, version")
    .eq("user_id", userId)
    .in("document", DOCS_OBRIGATORIOS);

  const ultima = new Map<string, string>();
  for (const linha of data ?? []) {
    const atual = ultima.get(linha.document);
    if (!atual || linha.version > atual) ultima.set(linha.document, linha.version);
  }

  return DOCS_OBRIGATORIOS.filter(
    (doc) => (ultima.get(doc) ?? "") < LEGAL_DOCS[doc].version
  ).map((doc) => ({
    document: doc,
    label: LEGAL_DOCS[doc].label,
    route: LEGAL_DOCS[doc].route,
    version: LEGAL_DOCS[doc].version,
    effectiveFrom: LEGAL_DOCS[doc].effectiveFrom,
    changes: LEGAL_DOCS[doc].changes as readonly string[],
  }));
}

/**
 * Registra o aceite feito no cadastro. Chamado de /auth/callback e
 * /auth/confirm, que são os primeiros requests server-side com sessão — é ali
 * que existem IP e user-agent reais para anexar ao ato.
 *
 * Só age em contas recém-criadas: um login de conta antiga não pode gerar
 * aceite em silêncio, senão os usuários pré-existentes nunca veriam o modal.
 */
export async function recordSignupAcceptances(userId: string, req: Request) {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  const criadoEm = data?.user?.created_at ? Date.parse(data.user.created_at) : NaN;
  if (!Number.isFinite(criadoEm) || Date.now() - criadoEm > 10 * 60 * 1000) return;

  const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
  for (const doc of DOCS_OBRIGATORIOS) {
    await recordAcceptance({
      userId,
      document: doc,
      action: "signup",
      req,
      metadata: {
        // Versão que o formulário de cadastro dizia estar mostrando: se
        // divergir da vigente, é sinal de deploy no meio do cadastro.
        versao_no_formulario:
          meta[doc === "termos" ? "terms_version" : "politica_version"] ?? null,
        provider: data?.user?.app_metadata?.provider ?? null,
      },
    });
  }
}
