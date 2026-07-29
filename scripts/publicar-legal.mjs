/**
 * Arquiva a versão vigente de cada documento legal em `legal_documents`.
 *
 *   node scripts/publicar-legal.mjs                              # localhost:3000
 *   node scripts/publicar-legal.mjs --base https://zafe.app.br   # produção
 *
 * Rode DEPOIS do `vercel --prod`: o script busca as páginas no ar, extrai o
 * texto e guarda o SHA-256 dele. Idempotente — rodar de novo não muda nada.
 *
 * O trabalho real acontece em /api/cron/publicar-legal, dentro da app, porque
 * é lá que vive `ensureLegalDocument` (TypeScript, service role). Aqui só há a
 * chamada autenticada com CRON_SECRET.
 */

import { readFileSync } from "node:fs";

function carregarEnvLocal() {
  try {
    for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // sem .env.local: as vars podem vir do ambiente
  }
}

carregarEnvLocal();

const baseIdx = process.argv.indexOf("--base");
const base = baseIdx !== -1 ? process.argv[baseIdx + 1] : "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("Falta CRON_SECRET (no .env.local ou no ambiente).");
  process.exit(1);
}

const res = await fetch(`${base}/api/cron/publicar-legal`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const body = await res.json().catch(() => null);

if (!body?.resultados) {
  console.error(`HTTP ${res.status}`, body ?? "(resposta sem JSON)");
  process.exit(1);
}

for (const r of body.resultados) {
  if (r.status === "erro") {
    console.error(`✗ ${r.document.padEnd(22)} ${r.erro}`);
  } else {
    console.log(`✓ ${r.document.padEnd(22)} ${r.version}  ${r.hash.slice(0, 16)}…  ${r.status}`);
  }
}

process.exit(body.ok ? 0 : 1);
