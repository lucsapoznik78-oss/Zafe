import { describe, expect, it } from "vitest";
import { adjudicate, parseOracleResponse, teamToSide, OracleCheck } from "../oracle";
import type { OracleVerdict } from "../types";

const validVerdict: OracleVerdict = {
  is_final: true,
  home_goals: 2,
  away_goals: 1,
  went_to_et: false,
  went_to_pens: false,
  winner_team: "Brasil",
  advanced_team: "Brasil",
  confidence: 0.95,
  source_url: "https://www.fifa.com/match/123",
};

const check = (v: Partial<OracleVerdict> | null, parseError: string | null = null): OracleCheck => ({
  raw: v ? JSON.stringify({ ...validVerdict, ...v }) : "sem json aqui",
  verdict: v ? { ...validVerdict, ...v } : null,
  parseError,
});

const groupMatch = { stage: "group" as const, home_team: "Brasil", away_team: "México" };
const koMatch = { stage: "r16" as const, home_team: "Brasil", away_team: "México" };

describe("parseOracleResponse", () => {
  it("parse direto de JSON puro", () => {
    const { verdict, error } = parseOracleResponse(JSON.stringify(validVerdict));
    expect(error).toBeNull();
    expect(verdict?.home_goals).toBe(2);
  });

  it("JSON dentro de markdown fences", () => {
    const raw = "```json\n" + JSON.stringify(validVerdict) + "\n```";
    expect(parseOracleResponse(raw).verdict).not.toBeNull();
  });

  it("JSON no meio de prosa", () => {
    const raw = `Após buscar na web, o resultado foi:\n${JSON.stringify(validVerdict)}\nFonte verificada.`;
    expect(parseOracleResponse(raw).verdict).not.toBeNull();
  });

  it("JSON malformado → erro (sem veredito)", () => {
    const { verdict, error } = parseOracleResponse('{"is_final": true, home_goals: dois}');
    expect(verdict).toBeNull();
    expect(error).toBeTruthy();
  });

  it("sem source_url → rejeitado (anti-alucinação)", () => {
    const { verdict } = parseOracleResponse(
      JSON.stringify({ ...validVerdict, source_url: "" })
    );
    expect(verdict).toBeNull();
  });

  it("gols fora da faixa (0–20) → rejeitado", () => {
    expect(parseOracleResponse(JSON.stringify({ ...validVerdict, home_goals: 25 })).verdict).toBeNull();
    expect(parseOracleResponse(JSON.stringify({ ...validVerdict, home_goals: -1 })).verdict).toBeNull();
  });

  it("prosa sem JSON → erro", () => {
    expect(parseOracleResponse("O Brasil venceu por 2 a 1.").verdict).toBeNull();
  });
});

describe("teamToSide", () => {
  it("mapeia com normalização de acentos/caixa", () => {
    expect(teamToSide("Brasil", koMatch)).toBe("home");
    expect(teamToSide("MÉXICO", koMatch)).toBe("away");
    expect(teamToSide("mexico", koMatch)).toBe("away");
  });
  it("time desconhecido → null", () => {
    expect(teamToSide("Argentina", koMatch)).toBeNull();
    expect(teamToSide(null, koMatch)).toBeNull();
  });
});

describe("adjudicate — double-check", () => {
  it("happy path: dois checks concordando → veredito", () => {
    const r = adjudicate(groupMatch, [check({}), check({})]);
    expect(r.kind).toBe("verdict");
    if (r.kind === "verdict") expect(r.verdict.home_goals).toBe(2);
  });

  it("is_final=false nos dois → not_final (tenta depois, não resolve)", () => {
    const nf = { is_final: false, winner_team: null, advanced_team: null };
    expect(adjudicate(groupMatch, [check(nf), check(nf)]).kind).toBe("not_final");
  });

  it("um final e outro não → review (disagreement)", () => {
    const r = adjudicate(groupMatch, [check({}), check({ is_final: false })]);
    expect(r.kind).toBe("review");
    if (r.kind === "review") expect(r.reason).toBe("disagreement");
  });

  it("fontes divergem no placar → review", () => {
    const r = adjudicate(groupMatch, [check({}), check({ home_goals: 3 })]);
    expect(r.kind).toBe("review");
    if (r.kind === "review") expect(r.reason).toBe("disagreement");
  });

  it("confidence baixa (0.6) → review", () => {
    const r = adjudicate(groupMatch, [check({}), check({ confidence: 0.6 })]);
    expect(r.kind).toBe("review");
    if (r.kind === "review") expect(r.reason).toBe("manual_review");
  });

  it("JSON malformado em um dos checks → review (parse_error)", () => {
    const r = adjudicate(groupMatch, [check({}), check(null)]);
    expect(r.kind).toBe("review");
    if (r.kind === "review") expect(r.reason).toBe("parse_error");
  });

  it("erro de API → review (api_error)", () => {
    const r = adjudicate(groupMatch, [check({}), check(null, "api_error")]);
    expect(r.kind).toBe("review");
    if (r.kind === "review") expect(r.reason).toBe("api_error");
  });

  it("mata-mata: classificado mapeado para advanced_side", () => {
    const pens = {
      home_goals: 1,
      away_goals: 1,
      went_to_et: true,
      went_to_pens: true,
      winner_team: "México",
      advanced_team: "México",
    };
    const r = adjudicate(koMatch, [check(pens), check(pens)]);
    expect(r.kind).toBe("verdict");
    if (r.kind === "verdict") expect(r.advancedSide).toBe("away");
  });

  it("mata-mata: checks divergem no classificado → review", () => {
    const a = { home_goals: 1, away_goals: 1, went_to_pens: true, went_to_et: true, advanced_team: "Brasil" };
    const b = { home_goals: 1, away_goals: 1, went_to_pens: true, went_to_et: true, advanced_team: "México" };
    expect(adjudicate(koMatch, [check(a), check(b)]).kind).toBe("review");
  });

  it("mata-mata: classificado contradiz o placar (sem pênaltis) → review", () => {
    const bad = { home_goals: 2, away_goals: 0, went_to_pens: false, advanced_team: "México", winner_team: "México" };
    expect(adjudicate(koMatch, [check(bad), check(bad)]).kind).toBe("review");
  });

  it("mata-mata: empate sem pênaltis (inconsistente) → review", () => {
    const bad = { home_goals: 1, away_goals: 1, went_to_pens: false, advanced_team: "Brasil" };
    expect(adjudicate(koMatch, [check(bad), check(bad)]).kind).toBe("review");
  });

  it("grupos: prorrogação/pênaltis (inconsistente) → review", () => {
    const bad = { went_to_pens: true };
    expect(adjudicate(groupMatch, [check(bad), check(bad)]).kind).toBe("review");
  });

  it("grupos: empate com winner_team null → veredito", () => {
    const draw = { home_goals: 1, away_goals: 1, winner_team: null, advanced_team: null };
    const r = adjudicate(groupMatch, [check(draw), check(draw)]);
    expect(r.kind).toBe("verdict");
    if (r.kind === "verdict") expect(r.advancedSide).toBeNull();
  });
});
