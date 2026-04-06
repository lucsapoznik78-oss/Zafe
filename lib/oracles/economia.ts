/**
 * Oracle de Economia
 * oracle_api_id formatos:
 *   "bcb:{serie}" — ex: "bcb:433" (IPCA), "bcb:11" (Selic)
 *   "crypto:BTC-BRL" — preço de crypto via CoinGecko
 *   "ptax:USD-BRL" — câmbio oficial BCB
 *
 * Auto-detecção: tópicos sobre dólar sem oracle_api_id usam PTAX histórico automaticamente.
 */

import type { OracleResult } from "./sports";

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
  const numberMatch = question.match(/[\d]+[,.]?[\d]*/);
  if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };
  const target = parseFloat(numberMatch[0].replace(",", "."));
  const q = question.toLowerCase();
  if (q.includes("superar") || q.includes("acima") || q.includes("ultrapassar")) {
    return { resultado: value > target ? "SIM" : "NAO", confianca: 95, fonte };
  }
  if (q.includes("abaixo") || q.includes("menor") || q.includes("cair")) {
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
  return null;
}
