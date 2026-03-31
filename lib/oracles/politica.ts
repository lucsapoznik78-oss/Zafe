/**
 * Oracle de Política
 * Perguntas políticas objetivas (votações no Congresso):
 *   oracle_api_id: "camara:{votacaoId}" | "senado:{votacaoId}"
 * Perguntas subjetivas (ex: "Lula vai ser preso?") → retorna null → vai para AI
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

// Câmara dos Deputados — votação específica
async function tryCamara(votacaoId: string, question: string): Promise<OracleResult | null> {
  const data = await fetchJson(
    `https://dadosabertos.camara.leg.br/api/v2/votacoes/${votacaoId}`
  );
  if (!data?.dados) return null;

  const aprovada = data.dados.aprovacao === 1 || data.dados.descricao?.toLowerCase().includes("aprovad");
  const fonte = `https://dadosabertos.camara.leg.br/api/v2/votacoes/${votacaoId}`;

  return { resultado: aprovada ? "SIM" : "NAO", confianca: 100, fonte };
}

// Senado Federal
async function trySenadoVotacao(votacaoId: string): Promise<OracleResult | null> {
  const data = await fetchJson(
    `https://legis.senado.leg.br/dadosabertos/votacao/${votacaoId}`
  );
  if (!data) return null;

  const resultado = data.VotacaoMateria?.Votacao?.DescricaoResultado ?? "";
  const fonte = `https://legis.senado.leg.br/dadosabertos/votacao/${votacaoId}`;

  if (resultado.toLowerCase().includes("aprovad")) return { resultado: "SIM", confianca: 100, fonte };
  if (resultado.toLowerCase().includes("rejeitad")) return { resultado: "NAO", confianca: 100, fonte };

  return null;
}

export async function oraclePolitica(
  oracleApiId: string,
  question: string
): Promise<OracleResult | null> {
  const [tipo, ...parts] = oracleApiId.split(":");
  const id = parts.join(":");

  if (tipo === "camara") return tryCamara(id, question);
  if (tipo === "senado") return trySenadoVotacao(id);

  // Sem API fixa → vai para AI
  return null;
}
