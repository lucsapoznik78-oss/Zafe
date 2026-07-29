import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileClock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal";

/**
 * Leitura do arquivo imutável de documentos legais (`legal_documents`).
 *
 * A versão vigente é servida pela própria página em JSX; estas telas existem
 * para as versões ANTERIORES — é o que permite mostrar, depois, o texto exato
 * que estava no ar quando o usuário aceitou (CDC art. 46; CC art. 434).
 */

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export async function LegalVersion({ doc, version }: { doc: LegalDoc; version: string }) {
  const meta = LEGAL_DOCS[doc];

  // A versão vigente tem página própria, com formatação e links.
  if (version === meta.version) {
    return (
      <div className="py-8 max-w-2xl mx-auto space-y-4 text-sm text-muted-foreground">
        <p>
          A versão <strong className="text-white">{version}</strong> é a vigente.
        </p>
        <Link href={meta.route} className="text-primary hover:underline">
          Ver {meta.label}
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("legal_documents")
    .select("version, document_hash, effective_from, summary_of_changes, content_md")
    .eq("document", doc)
    .eq("version", version)
    .maybeSingle();

  if (!data) notFound();

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6 text-sm text-muted-foreground">
      <Link
        href={`${meta.route}/historico`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
        Todas as versões
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
          {meta.label} — versão {data.version}
        </h1>
        <p className="text-xs">Vigorou a partir de {dataBR(data.effective_from)}</p>
      </div>

      <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-4 space-y-2">
        <p className="text-xs text-white font-semibold">Versão arquivada</p>
        <p className="text-xs leading-relaxed">
          Este texto não está mais em vigor. A versão vigente é a{" "}
          <strong className="text-white">{meta.version}</strong> —{" "}
          <Link href={meta.route} className="text-primary hover:underline">
            ler agora
          </Link>
          .
        </p>
      </div>

      {data.summary_of_changes && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">O que mudou nesta versão</h2>
          <ul className="list-disc pl-5 space-y-1">
            {data.summary_of_changes.split("\n").filter(Boolean).map((linha: string) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-white">Texto integral</h2>
        <p className="whitespace-pre-wrap leading-relaxed">{data.content_md}</p>
      </div>

      <div className="pt-4 border-t border-border/40 space-y-1">
        <p className="text-xs text-white font-semibold">Integridade</p>
        <p className="text-[11px] leading-relaxed break-all">
          SHA-256 do texto acima:{" "}
          <code className="text-white/80">{data.document_hash}</code>
        </p>
        <p className="text-[11px] leading-relaxed">
          É este hash que fica registrado junto ao aceite de cada usuário, para que se possa verificar
          que o texto não foi alterado depois.
        </p>
      </div>
    </div>
  );
}

export async function LegalHistory({ doc }: { doc: LegalDoc }) {
  const meta = LEGAL_DOCS[doc];

  const admin = createAdminClient();
  const { data } = await admin
    .from("legal_documents")
    .select("version, document_hash, effective_from, summary_of_changes")
    .eq("document", doc)
    .order("effective_from", { ascending: false });

  const versoes = data ?? [];

  return (
    <div className="py-8 max-w-2xl mx-auto space-y-6 text-sm text-muted-foreground">
      <Link
        href={meta.route}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
        Voltar para {meta.label}
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <FileClock size={20} className="text-primary" />
          Histórico — {meta.label}
        </h1>
        <p className="text-xs">
          Toda versão publicada fica arquivada com o texto integral e o hash SHA-256 dele.
        </p>
      </div>

      {versoes.length === 0 ? (
        <p>Nenhuma versão arquivada ainda.</p>
      ) : (
        <ul className="space-y-3">
          {versoes.map((v) => (
            <li key={v.version} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`${meta.route}/${v.version}`}
                  className="text-white font-semibold hover:text-primary transition-colors"
                >
                  Versão {v.version}
                </Link>
                {v.version === meta.version && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    vigente
                  </span>
                )}
              </div>
              <p className="text-xs">Em vigor desde {dataBR(v.effective_from)}</p>
              {v.summary_of_changes && (
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  {v.summary_of_changes.split("\n").filter(Boolean).map((linha: string) => (
                    <li key={linha}>{linha}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
