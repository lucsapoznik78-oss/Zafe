// Máscaras de input compartilhadas pelos forms de cadastro (LoginForm e
// CompletarCadastro). CPF tem as suas em lib/cpf.ts.

/** (11) 99999-9999 — aceita fixo (10 dígitos) e celular (11) */
export function formatarTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** DD/MM/AAAA conforme digita */
export function formatarDataBR(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** DD/MM/AAAA → "AAAA-MM-DD" ou null se inválida/futura/antes de 1900 */
export function dataBRparaISO(v: string): string | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejeita datas "normalizadas" pelo JS (ex.: 31/02 → 03/03)
  if (date.getUTCDate() !== Number(dd) || date.getUTCMonth() + 1 !== Number(mm)) return null;
  if (Number(yyyy) < 1900 || date.getTime() > Date.now()) return null;
  return `${yyyy}-${mm}-${dd}`;
}
