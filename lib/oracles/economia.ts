/**
 * Oracle de Economia
 * oracle_api_id formatos:
 *   "bcb:{serie}" — ex: "bcb:433" (IPCA), "bcb:11" (Selic)
 *   "crypto:BTC-BRL" — preço de crypto via CoinGecko
 *   "ptax:USD-BRL" — câmbio oficial BCB
 *   "firecrawl:{url}" — scrape de uma página/API e extração do valor via Firecrawl
 *
 * Auto-detecção: tópicos sobre dólar sem oracle_api_id usam PTAX histórico
 * automaticamente; perguntas sobre Selic/juros caem no Firecrawl como base.
 */

import type { OracleResult } from "./sports";
import { firecrawlExtract } from "@/lib/firecrawl";

// Compara um valor numérico contra o alvo extraído da pergunta (acima/abaixo).
function compararValor(value: number, question: string, fonte: string): OracleResult {
  const q = question.toLowerCase();
  const numberMatch = question.match(/[\d]+[.,]?[\d]*/);
  if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };
  const target = parseFloat(numberMatch[0].replace(".", "").replace(",", "."));
  if (q.includes("superar") || q.includes("acima") || q.includes("ultrapassar") || q.includes("maior")) {
    return { resultado: value > target ? "SIM" : "NAO", confianca: 92, fonte };
  }
  if (q.includes("abaixo") || q.includes("menor") || q.includes("cair")) {
    return { resultado: value < target ? "SIM" : "NAO", confianca: 92, fonte };
  }
  return { resultado: "INCERTO", confianca: 50, fonte };
}

// Base Firecrawl: faz scrape de um URL e extrai o valor numérico do indicador.
async function tryFirecrawl(url: string, question: string): Promise<OracleResult | null> {
  const data = await firecrawlExtract<{ valor?: number; data?: string }>(
    url,
    {
      type: "object",
      properties: {
        valor: {
          type: "number",
          description:
            "O valor numérico atual do indicador econômico relevante para a pergunta (ex: taxa Selic, IPCA, câmbio do dólar). Use ponto como separador decimal.",
        },
        data: {
          type: "string",
          description: "Data de referência do valor (ex: 17/06/2026), se disponível.",
        },
      },
      required: ["valor"],
    },
    `Extraia o valor numérico atual do indicador econômico relevante para esta pergunta: "${question}". Retorne apenas o número (ponto como separador decimal) e a data de referência.`
  );
  if (!data || typeof data.valor !== "number") return null;
  return compararValor(data.valor, question, url);
}

async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// PTAX histórico — retorna max rate de um período
async function ptaxPeriodo(dataInicio: Date, dataFim: Date): Promise<number | null> {
  const fmt = (d: Date) => {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}-${dd}-${d.getFullYear()}`;
  };
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${fmt(dataInicio)}'&@dataFinalCotacao='${fmt(dataFim)}'&$format=json`;
  const data = await fetchJson(url);
  if (!Array.isArray(data?.value) || data.value.length === 0) return null;
  // Retorna a cotação máxima de venda no período
  return Math.max(...data.value.map((v: any) => parseFloat(v.cotacaoVenda ?? "0")));
}

// PTAX do dia atual
async function ptaxHoje(): Promise<number | null> {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yyyy = today.getFullYear();
  const data = await fetchJson(
    `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${mm}-${dd}-${yyyy}'&$format=json`
  );
  return data?.value?.[0]?.cotacaoVenda ?? null;
}

async function tryBCB(serie: string, question: string): Promise<OracleResult | null> {
  const data = await fetchJson(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/5?formato=json`
  );
  if (!Array.isArray(data) || data.length === 0) return null;
  const latest = data[data.length - 1];
  const value = parseFloat(latest.valor?.replace(",", ".") ?? "0");
  const fonte = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/5`;
  const q = question.toLowerCase();

  // Detecta perguntas sobre corte/alta de juros (Copom/Selic)
  const isCortePergunta = q.includes("cortar") || q.includes("corte") || q.includes("reduzir") || q.includes("redução") || q.includes("cair") && q.includes("selic");
  const isAltaPergunta = q.includes("subir") || q.includes("alta") || q.includes("aumentar") || q.includes("elevar");
  const isManterPergunta = q.includes("manter") || q.includes("mantida") || q.includes("manteve") || q.includes("estável");

  if (isCortePergunta || isAltaPergunta || isManterPergunta) {
    if (data.length >= 2) {
      const prev = parseFloat(data[data.length - 2].valor?.replace(",", ".") ?? "0");
      const diff = parseFloat((value - prev).toFixed(4));
      const numberMatch = question.match(/[\d]+[,.][\d]+/);
      const targetCut = numberMatch ? parseFloat(numberMatch[0].replace(",", ".")) : null;

      if (isCortePergunta) {
        if (targetCut !== null) {
          // "cortar em X%" — verifica se o corte foi exatamente X (com tolerância de 0,01)
          return { resultado: Math.abs(diff + targetCut) < 0.02 ? "SIM" : "NAO", confianca: 93, fonte };
        }
        return { resultado: diff < -0.001 ? "SIM" : "NAO", confianca: 90, fonte };
      }
      if (isAltaPergunta) {
        return { resultado: diff > 0.001 ? "SIM" : "NAO", confianca: 90, fonte };
      }
      if (isManterPergunta) {
        return { resultado: Math.abs(diff) < 0.001 ? "SIM" : "NAO", confianca: 90, fonte };
      }
    }
  }

  const numberMatch = question.match(/[\d]+[,.]?[\d]*/);
  if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };
  const target = parseFloat(numberMatch[0].replace(",", "."));
  if (q.includes("superar") || q.includes("acima") || q.includes("ultrapassar")) {
    return { resultado: value > target ? "SIM" : "NAO", confianca: 95, fonte };
  }
  if (q.includes("abaixo") || q.includes("menor")) {
    return { resultado: value < target ? "SIM" : "NAO", confianca: 95, fonte };
  }
  return { resultado: "INCERTO", confianca: 50, fonte };
}

async function tryCoinGecko(pair: string, question: string): Promise<OracleResult | null> {
  const [coin] = pair.toLowerCase().split("-");
  const coinMap: Record<string, string> = { btc: "bitcoin", eth: "ethereum", sol: "solana", usdt: "tether" };
  const coinId = coinMap[coin] ?? coin;
  const data = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=brl`);
  if (!data?.[coinId]?.brl) return null;
  const price = data[coinId].brl;
  const fonte = `https://www.coingecko.com/en/coins/${coinId}`;
  const numberMatch = question.match(/[\d]+[,.]?[\d]*/);
  if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };
  const target = parseFloat(numberMatch[0].replace(".", "").replace(",", "."));
  const q = question.toLowerCase();
  if (q.includes("superar") || q.includes("acima")) return { resultado: price > target ? "SIM" : "NAO", confianca: 95, fonte };
  if (q.includes("abaixo") || q.includes("menor")) return { resultado: price < target ? "SIM" : "NAO", confianca: 95, fonte };
  return { resultado: "INCERTO", confianca: 50, fonte };
}

async function tryPTAX(question: string, closesAt?: string): Promise<OracleResult | null> {
  const fonte = "https://olinda.bcb.gov.br/olinda/servico/PTAX";
  const numberMatch = question.match(/[\d]+[,.][\d]+/);
  if (!numberMatch) return null;
  const target = parseFloat(numberMatch[0].replace(",", "."));
  const q = question.toLowerCase();

  let rate: number | null = null;

  // Se pergunta menciona semana ou período específico, usa PTAX histórico
  if (closesAt && (q.includes("semana") || q.includes("esta") || q.includes("essa"))) {
    const end = new Date(closesAt);
    // Semana = 7 dias antes do encerramento
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    rate = await ptaxPeriodo(start, end);
  }

  // Fallback: taxa de hoje
  if (!rate) rate = await ptaxHoje();
  if (!rate) return null;

  if (q.includes("superar") || q.includes("acima") || q.includes("ultrapassar") || q.includes("subir acima")) {
    return { resultado: rate > target ? "SIM" : "NAO", confianca: 95, fonte };
  }
  if (q.includes("fechar acima") || q.includes("fechou acima")) {
    return { resultado: rate > target ? "SIM" : "NAO", confianca: 95, fonte };
  }
  if (q.includes("abaixo") || q.includes("menor") || q.includes("cair abaixo")) {
    return { resultado: rate < target ? "SIM" : "NAO", confianca: 95, fonte };
  }
  return { resultado: "INCERTO", confianca: 50, fonte };
}

// Auto-detecta dólar/câmbio na pergunta e usa PTAX
function isDollarQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes("dólar") || q.includes("dolar") || q.includes("usd") || q.includes("câmbio") || q.includes("cambio");
}

export async function oracleEconomia(
  oracleApiId: string,
  question: string,
  closesAt?: string
): Promise<OracleResult | null> {
  const [tipo, ...parts] = oracleApiId.split(":");
  const id = parts.join(":");
  if (tipo === "bcb") return tryBCB(id, question);
  if (tipo === "crypto") return tryCoinGecko(id, question);
  if (tipo === "ptax") return tryPTAX(question, closesAt);
  if (tipo === "firecrawl") return tryFirecrawl(id, question);
  return null;
}

// Auto-oracle para economia sem oracle_api_id
export async function oracleEconomiaAuto(question: string, closesAt: string): Promise<OracleResult | null> {
  if (isDollarQuestion(question)) {
    return tryPTAX(question, closesAt);
  }
  // IBOVESPA via Yahoo Finance
  const q = question.toLowerCase();
  if (q.includes("ibovespa") || q.includes("ibov")) {
    try {
      const data = await fetchJson("https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?interval=1d&range=5d");
      const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
      const lastClose = closes.filter(Boolean).pop();
      if (lastClose) {
        const numberMatch = question.match(/[\d]{3,}([,.][\d]+)?/);
        if (numberMatch) {
          const target = parseFloat(numberMatch[0].replace(".", "").replace(",", "."));
          if (q.includes("superar") || q.includes("acima")) return { resultado: lastClose > target ? "SIM" : "NAO", confianca: 92, fonte: "https://finance.yahoo.com/quote/%5EBVSP" };
          if (q.includes("abaixo") || q.includes("cair")) return { resultado: lastClose < target ? "SIM" : "NAO", confianca: 92, fonte: "https://finance.yahoo.com/quote/%5EBVSP" };
        }
      }
    } catch { /* ignore */ }
  }

  // Selic / juros via Firecrawl (página oficial do BCB) como base de fallback
  if (q.includes("selic") || q.includes("juros") || q.includes("copom")) {
    const fc = await tryFirecrawl("https://www.bcb.gov.br/controleinflacao/taxaselic", question);
    if (fc && fc.resultado !== "INCERTO") return fc;
  }

  return null;
}
