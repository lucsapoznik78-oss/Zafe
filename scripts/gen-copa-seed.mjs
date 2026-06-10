#!/usr/bin/env node
// Gera supabase/migrations/028_copa_fixture_seed.sql a partir de
// scripts/data/copa-2026-fixture.json (tabela oficial FIFA, revisada).
// Idempotente: INSERT ... ON CONFLICT (match_number) DO NOTHING.
// Aplicar manualmente no SQL editor do Supabase (workflow do repo).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(
  readFileSync(join(root, "scripts/data/copa-2026-fixture.json"), "utf8")
);

const VALID_STAGES = new Set(["group", "r32", "r16", "qf", "sf", "third", "final"]);

// Validação dura antes de gerar SQL — fixture quebrado não vira migration.
const numbers = new Set();
for (const m of fixture) {
  if (!Number.isInteger(m.match_number) || m.match_number < 1 || m.match_number > 104)
    throw new Error(`match_number inválido: ${m.match_number}`);
  if (numbers.has(m.match_number)) throw new Error(`match_number duplicado: ${m.match_number}`);
  numbers.add(m.match_number);
  if (!VALID_STAGES.has(m.stage)) throw new Error(`stage inválido em #${m.match_number}: ${m.stage}`);
  if (Number.isNaN(Date.parse(m.kickoff_utc)))
    throw new Error(`kickoff_utc inválido em #${m.match_number}: ${m.kickoff_utc}`);
  if (m.stage === "group" && (!m.home_team || !m.away_team))
    throw new Error(`jogo de grupos #${m.match_number} sem times`);
  if (m.stage !== "group" && (!m.home_placeholder || !m.away_placeholder))
    throw new Error(`mata-mata #${m.match_number} sem placeholders`);
}
if (fixture.length !== 104) throw new Error(`esperado 104 jogos, recebi ${fixture.length}`);

const lit = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

const rows = [...fixture]
  .sort((a, b) => a.match_number - b.match_number)
  .map(
    (m) =>
      `  (${m.match_number}, ${lit(m.stage)}, ${lit(m.group_name)}, ${lit(m.home_team)}, ` +
      `${lit(m.away_team)}, ${lit(m.home_placeholder)}, ${lit(m.away_placeholder)}, ${lit(m.kickoff_utc)})`
  )
  .join(",\n");

const sql = `-- ============================================================
-- 028 — Zafe Copa 2026: seed do fixture oficial FIFA (104 partidas)
-- Gerado por scripts/gen-copa-seed.mjs a partir de
-- scripts/data/copa-2026-fixture.json — NÃO editar à mão.
-- 72 jogos de grupos (times reais) + 32 slots de mata-mata
-- (placeholders, times preenchidos pelo admin conforme o avanço).
-- Idempotente: ON CONFLICT (match_number) DO NOTHING.
-- Requer 027_copa_core.sql aplicada.
-- ============================================================

INSERT INTO copa_matches
  (competition_id, match_number, stage, group_name, home_team, away_team,
   home_placeholder, away_placeholder, kickoff_at)
SELECT c.id, f.match_number, f.stage, f.group_name, f.home_team, f.away_team,
       f.home_placeholder, f.away_placeholder, f.kickoff_at::timestamptz
FROM (VALUES
${rows}
) AS f(match_number, stage, group_name, home_team, away_team,
       home_placeholder, away_placeholder, kickoff_at)
CROSS JOIN copa_competition c
WHERE c.slug = 'copa-2026'
ON CONFLICT (match_number) DO NOTHING;
`;

const out = join(root, "supabase/migrations/028_copa_fixture_seed.sql");
writeFileSync(out, sql);
console.log(`OK: ${fixture.length} partidas → ${out}`);
