/**
 * Oracle de Tecnologia
 * oracle_api_id formatos:
 *   "github:{dono}/{repo}" — stars, releases, forks
 *   "npm:{pacote}" — downloads semanais
 *   "pypi:{pacote}" — downloads totais
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

// GitHub API — repos públicos (sem key: 60 req/h, com token: 5000/h)
async function tryGitHub(repo: string, question: string): Promise<OracleResult | null> {
  const headers: Record<string, string> = {};
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const data = await fetchJson(`https://api.github.com/repos/${repo}`, headers);
  if (!data) return null;

  const fonte = `https://github.com/${repo}`;
  const q = question.toLowerCase();

  // Perguntas sobre stars
  if (q.includes("star")) {
    const stars = data.stargazers_count;
    const numberMatch = question.match(/[\d]+[,.]?[\d]*/);
    if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };
    const target = parseFloat(numberMatch[0].replace(",", ".")) * (q.includes("mil") ? 1000 : 1);
    if (q.includes("superar") || q.includes("acima") || q.includes("atingir")) {
      return { resultado: stars >= target ? "SIM" : "NAO", confianca: 100, fonte };
    }
  }

  // Perguntas sobre releases
  if (q.includes("lançar") || q.includes("lançamento") || q.includes("release") || q.includes("versão")) {
    const releaseData = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`, headers);
    if (!releaseData?.tag_name) return { resultado: "NAO", confianca: 80, fonte };

    const tag = releaseData.tag_name.toLowerCase();
    const versionMatch = question.match(/v?[\d]+\.[\d]+\.?[\d]*/i);
    if (versionMatch) {
      const targetVersion = versionMatch[0].toLowerCase().replace("v", "");
      const releasedVersion = tag.replace("v", "");
      return {
        resultado: releasedVersion >= targetVersion ? "SIM" : "NAO",
        confianca: 100,
        fonte: `https://github.com/${repo}/releases/latest`,
      };
    }

    return { resultado: "SIM", confianca: 85, fonte: `https://github.com/${repo}/releases/latest` };
  }

  // Perguntas sobre forks
  if (q.includes("fork")) {
    const forks = data.forks_count;
    const numberMatch = question.match(/[\d]+/);
    if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };
    const target = parseInt(numberMatch[0]);
    return { resultado: forks >= target ? "SIM" : "NAO", confianca: 100, fonte };
  }

  return null;
}

// NPM downloads
async function tryNPM(pkg: string, question: string): Promise<OracleResult | null> {
  const data = await fetchJson(`https://api.npmjs.org/downloads/point/last-week/${pkg}`);
  if (!data?.downloads) return null;

  const downloads = data.downloads;
  const fonte = `https://www.npmjs.com/package/${pkg}`;
  const numberMatch = question.match(/[\d]+[,.]?[\d]*/);
  if (!numberMatch) return { resultado: "INCERTO", confianca: 50, fonte };

  const target = parseFloat(numberMatch[0].replace(",", ".")) *
    (question.toLowerCase().includes("mil") ? 1000 : 1) *
    (question.toLowerCase().includes("milhão") ? 1_000_000 : 1);

  const q = question.toLowerCase();
  if (q.includes("superar") || q.includes("acima")) {
    return { resultado: downloads > target ? "SIM" : "NAO", confianca: 95, fonte };
  }

  return null;
}

export async function oracleTecnologia(
  oracleApiId: string,
  question: string
): Promise<OracleResult | null> {
  const [tipo, ...parts] = oracleApiId.split(":");
  const id = parts.join(":");

  if (tipo === "github") return tryGitHub(id, question);
  if (tipo === "npm") return tryNPM(id, question);

  return null;
}
