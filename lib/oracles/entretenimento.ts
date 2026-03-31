/**
 * Oracle de Entretenimento
 * oracle_api_id formatos:
 *   "tmdb:movie:{id}" — bilheteria/avaliação de filme
 *   "tmdb:tv:{id}" — série/episódio
 *   "tvmaze:{showId}" — episódio de série (gratuito, sem key)
 * BBB, ENEM, reality shows → retorna null → vai para AI
 */

import type { OracleResult } from "./sports";

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json", ...headers },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// TMDB — filmes e séries
async function tryTMDB(mediaType: string, tmdbId: string, question: string): Promise<OracleResult | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return null;

  const data = await fetchJson(
    `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${key}&language=pt-BR`
  );
  if (!data) return null;

  const fonte = `https://www.themoviedb.org/${mediaType}/${tmdbId}`;
  const q = question.toLowerCase();

  // Perguntas sobre avaliação
  const ratingMatch = question.match(/[\d]+[,.]?[\d]*/);
  if (ratingMatch && (q.includes("nota") || q.includes("avaliação") || q.includes("pontuação"))) {
    const target = parseFloat(ratingMatch[0].replace(",", "."));
    const rating = data.vote_average;
    if (!rating) return null;
    if (q.includes("acima") || q.includes("superar")) {
      return { resultado: rating > target ? "SIM" : "NAO", confianca: 95, fonte };
    }
    if (q.includes("abaixo")) {
      return { resultado: rating < target ? "SIM" : "NAO", confianca: 95, fonte };
    }
  }

  // Perguntas sobre bilheteria
  if (q.includes("bilheteria") || q.includes("arrecad")) {
    const revenue = data.revenue; // em USD
    if (!revenue) return null;
    const numberMatch = question.match(/[\d]+[,.]?[\d]*/);
    if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };
    const target = parseFloat(numberMatch[0].replace(".", "").replace(",", "."));
    const revenueM = revenue / 1_000_000;
    if (q.includes("milhão") || q.includes("milhões")) {
      return { resultado: revenueM > target ? "SIM" : "NAO", confianca: 95, fonte };
    }
  }

  return null;
}

// TVMaze — séries, completamente gratuito
async function tryTVMaze(showId: string, question: string): Promise<OracleResult | null> {
  const data = await fetchJson(
    `https://api.tvmaze.com/shows/${showId}?embed=episodes`
  );
  if (!data) return null;

  const fonte = `https://www.tvmaze.com/shows/${showId}`;
  const status = data.status; // "Running" | "Ended" | "In Development"

  const q = question.toLowerCase();
  if (q.includes("cancelad") || q.includes("cancelar")) {
    return { resultado: status === "Ended" ? "SIM" : "NAO", confianca: 85, fonte };
  }
  if (q.includes("renovad") || q.includes("renova")) {
    return { resultado: status === "Running" ? "SIM" : "NAO", confianca: 85, fonte };
  }

  return null;
}

export async function oracleEntretenimento(
  oracleApiId: string,
  question: string
): Promise<OracleResult | null> {
  const [tipo, ...parts] = oracleApiId.split(":");

  if (tipo === "tmdb") {
    const mediaType = parts[0]; // "movie" ou "tv"
    const id = parts[1];
    if (mediaType && id) return tryTMDB(mediaType, id, question);
  }

  if (tipo === "tvmaze") {
    return tryTVMaze(parts[0], question);
  }

  // BBB, ENEM, reality → AI
  return null;
}
