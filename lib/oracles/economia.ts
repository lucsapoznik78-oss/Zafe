/**
 * Oracle de Economia
 * oracle_api_id formatos:
 *   "bcb:{serie}" — ex: "bcb:433" (IPCA), "bcb:11" (Selic)
 *   "crypto:BTC-BRL" — preço de crypto via CoinGecko
 *   "ptax:USD-BRL" — câmbio oficial BCB
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

// BCB — Banco Central do Brasil, séries temporais
async function tryBCB(serie: string, question: string): Promise<OracleResult | null> {
  const data = await fetchJson(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/5?formato=json`
  );
  if (!Array.isArray(data) || data.length === 0) return null;

  const latest = data[data.length - 1];
  const value = parseFloat(latest.valor?.replace(",", ".") ?? "0");
  const fonte = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/5`;

  // Tenta extrair número alvo da pergunta para comparação
  // ex: "A Selic vai superar 12%?" → extrai 12
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
  if (q.includes("atingir") || q.includes("chegar")) {
    return { resultado: Math.abs(value - target) < 0.1 ? "SIM" : "NAO", confianca: 90, fonte };
  }

  return { resultado: "INCERTO", confianca: 50, fonte };
}

// CoinGecko — preços de crypto em BRL
async function tryCoinGecko(pair: string, question: string): Promise<OracleResult | null> {
  const [coin] = pair.toLowerCase().split("-");
  const coinMap: Record<string, string> = {
    btc: "bitcoin", eth: "ethereum", sol: "solana", usdt: "tether",
  };
  const coinId = coinMap[coin] ?? coin;

  const data = await fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=brl`
  );
  if (!data?.[coinId]?.brl) return null;

  const price = data[coinId].brl;
  const fonte = `https://www.coingecko.com/en/coins/${coinId}`;

  const numberMatch = question.match(/[\d]+[,.]?[\d]*/);
  if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };

  const target = parseFloat(numberMatch[0].replace(".", "").replace(",", "."));
  const q = question.toLowerCase();

  if (q.includes("superar") || q.includes("acima") || q.includes("ultrapassar")) {
    return { resultado: price > target ? "SIM" : "NAO", confianca: 95, fonte };
  }
  if (q.includes("abaixo") || q.includes("menor")) {
    return { resultado: price < target ? "SIM" : "NAO", confianca: 95, fonte };
  }

  return { resultado: "INCERTO", confianca: 50, fonte };
}

// PTAX — câmbio oficial do BCB
async function tryPTAX(question: string): Promise<OracleResult | null> {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yyyy = today.getFullYear();

  const data = await fetchJson(
    `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${mm}-${dd}-${yyyy}'&$format=json`
  );

  const rate = data?.value?.[0]?.cotacaoVenda;
  if (!rate) return null;

  const fonte = "https://olinda.bcb.gov.br/olinda/servico/PTAX";
  const numberMatch = question.match(/[\d]+[,.][\d]+/);
  if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };

  const target = parseFloat(numberMatch[0].replace(",", "."));
  const q = question.toLowerCase();

  if (q.includes("superar") || q.includes("acima")) {
    return { resultado: rate > target ? "SIM" : "NAO", confianca: 95, fonte };
  }
  if (q.includes("abaixo") || q.includes("menor")) {
    return { resultado: rate < target ? "SIM" : "NAO", confianca: 95, fonte };
  }

  return { resultado: "INCERTO", confianca: 50, fonte };
}

export async function oracleEconomia(
  oracleApiId: string,
  question: string
): Promise<OracleResult | null> {
  const [tipo, ...parts] = oracleApiId.split(":");
  const id = parts.join(":");

  if (tipo === "bcb") return tryBCB(id, question);
  if (tipo === "crypto") return tryCoinGecko(id, question);
  if (tipo === "ptax") return tryPTAX(question);

  return null;
}
