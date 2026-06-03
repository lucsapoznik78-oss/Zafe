/**
 * Cliente Firecrawl (scrape + extração JSON via LLM).
 *
 * Usado como uma das bases de resolução do módulo Econômico: dado um URL
 * (ex: página/API do BCB), o Firecrawl extrai um valor numérico estruturado
 * — ex: "Selic = 14,50%, data = 17/06/2026" — conforme um schema.
 *
 * Requer env:
 *   - FIRECRAWL_API_KEY → chave da API (https://firecrawl.dev)
 *
 * Se a chave não estiver configurada, retorna null (no-op) para não quebrar
 * o fluxo de resolução em ambientes sem Firecrawl.
 */

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";

export interface FirecrawlJsonFormat {
  type: "json";
  schema: Record<string, unknown>;
  prompt: string;
}

/**
 * Faz scrape de um URL e extrai dados estruturados via schema JSON.
 * Retorna o objeto extraído (data) ou null em qualquer falha.
 */
export async function firecrawlExtract<T = Record<string, unknown>>(
  url: string,
  schema: Record<string, unknown>,
  prompt: string
): Promise<T | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn(`[firecrawl] FIRECRAWL_API_KEY ausente — scrape ignorado: ${url}`);
    return null;
  }

  try {
    const res = await fetch(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: [{ type: "json", schema, prompt } satisfies FirecrawlJsonFormat],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[firecrawl] Falha (${res.status}): ${txt.slice(0, 200)}`);
      return null;
    }

    const json = await res.json();
    if (!json?.success || !json?.data) {
      console.warn(`[firecrawl] Resposta sem dados para ${url}`);
      return null;
    }
    return json.data as T;
  } catch (e: any) {
    console.error("[firecrawl] Erro de rede:", e?.message);
    return null;
  }
}
