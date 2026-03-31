/**
 * Oracle de Esportes
 * Tenta na ordem: api-futebol.com.br → api-football → ESPN → TheSportsDB
 * oracle_api_id formato esperado: "football:{fixtureId}" | "espn:{sport}/{league}/{eventId}" | "sportsdb:{eventId}"
 */

export interface OracleResult {
  resultado: "SIM" | "NAO" | "INCERTO";
  confianca: number;
  fonte: string;
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    headers: { "Accept": "application/json", ...headers },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return res.json();
}

// api-football (api-sports.io) — fixture by ID
async function tryApiFootball(fixtureId: string, question: string): Promise<OracleResult | null> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return null;

  const data = await fetchJson(
    `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
    { "x-apisports-key": key }
  );
  const fixture = data?.response?.[0];
  if (!fixture) return null;

  const status = fixture.fixture?.status?.short;
  // FT = full time, AET = after extra time, PEN = penalties
  if (!["FT", "AET", "PEN"].includes(status)) return null;

  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  const fonte = `https://www.api-football.com/fixture/${fixtureId}`;

  // Verificar qual time ganhou
  const homeWon = home?.winner === true;
  const awayWon = away?.winner === true;

  const q = question.toLowerCase();
  const homeNameInQuestion = q.includes(home?.name?.toLowerCase());
  const awayNameInQuestion = q.includes(away?.name?.toLowerCase());

  if (homeNameInQuestion && homeWon) return { resultado: "SIM", confianca: 100, fonte };
  if (homeNameInQuestion && awayWon) return { resultado: "NAO", confianca: 100, fonte };
  if (awayNameInQuestion && awayWon) return { resultado: "SIM", confianca: 100, fonte };
  if (awayNameInQuestion && homeWon) return { resultado: "NAO", confianca: 100, fonte };

  // Draw
  if (!homeWon && !awayWon) {
    // Se pergunta é sobre vitória de algum time → NAO
    if (homeNameInQuestion || awayNameInQuestion) return { resultado: "NAO", confianca: 100, fonte };
  }

  return null;
}

// ESPN — completamente gratuito, sem key
async function tryESPN(sport: string, league: string, eventId: string, question: string): Promise<OracleResult | null> {
  const data = await fetchJson(
    `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`
  );
  if (!data) return null;

  const competition = data.header?.competitions?.[0];
  if (!competition) return null;

  const completed = competition.status?.type?.completed;
  if (!completed) return null;

  const competitors = competition.competitors ?? [];
  const winner = competitors.find((c: any) => c.winner === true);
  if (!winner) return null;

  const fonte = `https://www.espn.com/${sport}/${league}/game?gameId=${eventId}`;
  const q = question.toLowerCase();
  const winnerName = winner.team?.displayName?.toLowerCase() ?? "";

  if (q.includes(winnerName)) return { resultado: "SIM", confianca: 100, fonte };
  // Perdedor mencionado na pergunta
  const loser = competitors.find((c: any) => c.winner !== true);
  const loserName = loser?.team?.displayName?.toLowerCase() ?? "";
  if (q.includes(loserName)) return { resultado: "NAO", confianca: 100, fonte };

  return null;
}

// TheSportsDB — gratuito
async function tryTheSportsDB(eventId: string, question: string): Promise<OracleResult | null> {
  const data = await fetchJson(
    `https://www.thesportsdb.com/api/v1/json/3/lookupevent.php?id=${eventId}`
  );
  const event = data?.events?.[0];
  if (!event) return null;

  if (event.strStatus !== "Match Finished") return null;

  const fonte = `https://www.thesportsdb.com/event/${eventId}`;
  const scoreHome = parseInt(event.intHomeScore ?? "0");
  const scoreAway = parseInt(event.intAwayScore ?? "0");

  const homeTeam = event.strHomeTeam?.toLowerCase() ?? "";
  const awayTeam = event.strAwayTeam?.toLowerCase() ?? "";
  const q = question.toLowerCase();

  const homeWon = scoreHome > scoreAway;
  const awayWon = scoreAway > scoreHome;

  if (q.includes(homeTeam)) return { resultado: homeWon ? "SIM" : "NAO", confianca: 100, fonte };
  if (q.includes(awayTeam)) return { resultado: awayWon ? "SIM" : "NAO", confianca: 100, fonte };

  return null;
}

export async function oracleEsportes(
  oracleApiId: string,
  question: string
): Promise<OracleResult | null> {
  const [tipo, ...parts] = oracleApiId.split(":");
  const id = parts.join(":");

  if (tipo === "football") {
    return tryApiFootball(id, question);
  }

  if (tipo === "espn") {
    // formato: espn:football/nfl/401671795
    const segments = id.split("/");
    if (segments.length >= 3) {
      const eventId = segments[segments.length - 1];
      const league = segments[segments.length - 2];
      const sport = segments[segments.length - 3];
      return tryESPN(sport, league, eventId, question);
    }
  }

  if (tipo === "sportsdb") {
    return tryTheSportsDB(id, question);
  }

  return null;
}
