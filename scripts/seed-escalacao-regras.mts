// Seed do catálogo do Modo Escalação + dos rulesets transcritos dos manuais.
//
//   node scripts/seed-escalacao-regras.mts              # grava como RASCUNHO
//   node scripts/seed-escalacao-regras.mts --publicar   # grava e PUBLICA
//
// (é .mts porque importa os rulesets tipados direto de lib/escalacao/rulesets/;
// o Node 22.18+ faz o type stripping sozinho, sem build.)
//
// Publicar é irreversível: o trigger T5 (Art. 24 § único) torna o ruleset
// imutável a partir daí. Emenda depois disso = nova versão. Por isso o padrão
// do script é gravar como rascunho e deixar a publicação como ato explícito.
//
// O script é idempotente: ruleset já publicado é PULADO, nunca sobrescrito.

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { boxeV1 } from "../lib/escalacao/rulesets/boxe.v1.ts";
import { f1V1 } from "../lib/escalacao/rulesets/f1.v1.ts";
import { futebolV1 } from "../lib/escalacao/rulesets/futebol.v1.ts";
import { nbaV1 } from "../lib/escalacao/rulesets/nba.v1.ts";
import { nflV1 } from "../lib/escalacao/rulesets/nfl.v1.ts";
import { surfV1 } from "../lib/escalacao/rulesets/surf.v1.ts";
import { tenisV1 } from "../lib/escalacao/rulesets/tenis.v1.ts";
import { ufcV1 } from "../lib/escalacao/rulesets/ufc.v1.ts";
import { valorantV1 } from "../lib/escalacao/rulesets/valorant.v1.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltam env vars: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const PUBLICAR = process.argv.includes("--publicar");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Teto de titulares por esporte (Art. 10). O card pode apertar mais, nunca afrouxar.
const ESPORTES = [
  { key: "ufc", nome: "UFC", ordem: 1 },
  { key: "boxe", nome: "Boxe", ordem: 2 },
  { key: "f1", nome: "Fórmula 1", ordem: 3 },
  { key: "surf", nome: "Surf", ordem: 4 },
  { key: "tenis", nome: "Tênis", ordem: 5 },
  { key: "futebol", nome: "Futebol", ordem: 6 },
  { key: "nba", nome: "Basquete", ordem: 7 },
  { key: "nfl", nome: "Futebol Americano", ordem: 8 },
  { key: "valorant", nome: "Valorant", ordem: 9 },
];

const COMPETICOES = [
  { slug: "ufc", nome: "UFC", esporte_key: "ufc", modo: "mix" },
  { slug: "boxe", nome: "Boxe", esporte_key: "boxe", modo: "mix" },
  { slug: "f1", nome: "Fórmula 1", esporte_key: "f1", modo: "mix" },
  { slug: "wsl-ct", nome: "WSL Championship Tour", esporte_key: "surf", modo: "mix" },
  { slug: "atp", nome: "ATP Tour", esporte_key: "tenis", modo: "mix" },
  // Art. 11: a Champions tem teto próprio de 3 titulares, mais restritivo que o
  // teto de 4 do esporte. 216 atletas num pool de 36 clubes desequilibraria o
  // card se um usuário pudesse ocupar 4 vagas com jogadores do mesmo torneio.
  {
    slug: "champions",
    nome: "UEFA Champions League",
    esporte_key: "futebol",
    modo: "mix",
    teto_titulares: 3,
  },
  { slug: "nba", nome: "Basquete", esporte_key: "nba", modo: "mix" },
  { slug: "nfl", nome: "Futebol Americano", esporte_key: "nfl", modo: "mix" },
  { slug: "vct", nome: "Valorant Champions Tour", esporte_key: "valorant", modo: "mix" },
];

const RULESETS = [ufcV1, boxeV1, f1V1, surfV1, tenisV1, futebolV1, nbaV1, nflV1, valorantV1];

async function main() {
  for (const e of ESPORTES) {
    const { error } = await supabase.from("escalacao_esporte").upsert(e, { onConflict: "key" });
    if (error) throw new Error(`esporte ${e.key}: ${error.message}`);
  }
  console.log(`esportes: ${ESPORTES.length} ok`);

  for (const c of COMPETICOES) {
    const { error } = await supabase.from("escalacao_competicao").upsert(c, { onConflict: "slug" });
    if (error) throw new Error(`competicao ${c.slug}: ${error.message}`);
  }
  console.log(`competições: ${COMPETICOES.length} ok`);

  for (const rs of RULESETS) {
    const { data: existente, error: erroLeitura } = await supabase
      .from("escalacao_regra")
      .select("id, publicado_em")
      .eq("esporte_key", rs.esporte)
      .eq("versao", rs.versao)
      .maybeSingle();
    if (erroLeitura) throw new Error(`${rs.esporte}.v${rs.versao}: ${erroLeitura.message}`);

    if (existente?.publicado_em) {
      console.log(`${rs.esporte}.v${rs.versao}: já publicado — pulando (imutável)`);
      continue;
    }

    const linha = {
      esporte_key: rs.esporte,
      versao: rs.versao,
      regras: rs.regras,
      stats: rs.stats,
      teto_evento: rs.tetoEvento,
      piso_evento: rs.pisoEvento,
      agregacao_mes: rs.agregacaoMes,
      ev_alvo: rs.evAlvo ?? null,
      conteudo_hash: createHash("sha256")
        .update(JSON.stringify({ regras: rs.regras, stats: rs.stats }))
        .digest("hex"),
      publicado_em: PUBLICAR ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from("escalacao_regra")
      .upsert(linha, { onConflict: "esporte_key,versao" });
    if (error) throw new Error(`${rs.esporte}.v${rs.versao}: ${error.message}`);

    console.log(
      `${rs.esporte}.v${rs.versao}: ${rs.regras.length} regras, ${rs.stats.length} stats` +
        `${PUBLICAR ? " — PUBLICADO" : " (rascunho)"}`
    );
  }

  if (!PUBLICAR) {
    console.log("\nrode com --publicar para publicar (irreversível: vira imutável)");
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
