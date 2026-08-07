// Leituras da superfície pública do Modo Escalação.
//
// Ao contrário de `queries.ts` (admin, service role), tudo aqui roda com o
// cliente do usuário: as policies de SELECT já escondem card em rascunho,
// ruleset não publicado e a escalação alheia antes do fechamento.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CardPublico {
  id: string;
  titulo: string;
  mes: string;
  status: string;
  n_titulares: number;
  n_reservas: number;
  teto_por_esporte: number;
  teto_conta_reservas: boolean;
  entrada_z: number;
  abre_em: string;
  fecha_em: string;
}

export interface EsporteDoCard {
  esporte_key: string;
  nome: string;
  fecha_em: string | null;
  /** `[rotulo, resumo]` de cada regra — a tabela de pontuação, sem código por esporte. */
  regras: Array<{ rotulo: string; resumo: string }>;
}

export interface AtletaDoPool {
  card_atleta_id: string;
  nome: string;
  esporte_key: string;
  genero: string;
}

export interface SlotDoTime {
  card_atleta_id: string;
  papel: "titular" | "reserva";
  ordem: number;
}

export interface MeuTime {
  id: string;
  status: string;
  nome: string | null;
  pontos_total: number | null;
  premio_z: number | null;
  slots: SlotDoTime[];
}

/**
 * O card de mix mais recente que já saiu do rascunho. O modo fixo ainda não
 * estreou (Art. 15 depende de decisão de produto), então a página pública só
 * conhece o mix.
 */
export async function getCardVigente(supabase: SupabaseClient): Promise<CardPublico | null> {
  const { data } = await supabase
    .from("escalacao_card")
    .select(
      "id, titulo, mes, status, n_titulares, n_reservas, teto_por_esporte, teto_conta_reservas, entrada_z, abre_em, fecha_em"
    )
    .eq("modo", "mix")
    .order("mes", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CardPublico | null) ?? null;
}

/** Resume uma regra do DSL numa linha legível. Genérico: nasce do JSONB. */
function resumirRegra(r: Record<string, unknown>): string {
  const n = (v: unknown) => (Number(v) > 0 ? `+${v}` : `${v}`);
  switch (r.tipo) {
    case "lookup": {
      const mapa = (r.mapa ?? {}) as Record<string, number>;
      return Object.entries(mapa)
        .filter(([, p]) => p !== 0)
        .map(([k, p]) => `${k.replace(/_/g, " ")} ${n(p)}`)
        .join(" · ");
    }
    case "linear":
      return `${n(r.fator)} por unidade`;
    case "flag":
      return n(r.pontos);
    case "bloco":
      return `${n(r.fator)} a cada ${r.bloco}`;
    case "limiar":
      return `${r.op} ${r.valor} → ${n(r.pontos)}`;
    case "faixa": {
      const faixas = (r.faixas ?? []) as Array<{ min: number; max: number; pontos: number }>;
      return faixas.map((f) => `${f.min}–${f.max} ${n(f.pontos)}`).join(" · ");
    }
    default:
      return "";
  }
}

export async function getEsportesDoCard(
  supabase: SupabaseClient,
  cardId: string
): Promise<EsporteDoCard[]> {
  const { data } = await supabase
    .from("escalacao_card_esporte")
    .select("esporte_key, fecha_em, escalacao_esporte(nome, ordem), escalacao_regra(regras)")
    .eq("card_id", cardId);

  return (data ?? [])
    .map((linha) => {
      const esporte = linha.escalacao_esporte as unknown as
        | { nome: string; ordem: number }
        | { nome: string; ordem: number }[]
        | null;
      const e = Array.isArray(esporte) ? esporte[0] : esporte;
      const regra = linha.escalacao_regra as unknown as
        | { regras: Record<string, unknown>[] }
        | { regras: Record<string, unknown>[] }[]
        | null;
      const rs = Array.isArray(regra) ? regra[0] : regra;
      return {
        esporte_key: linha.esporte_key as string,
        nome: e?.nome ?? (linha.esporte_key as string),
        ordem: e?.ordem ?? 99,
        fecha_em: (linha.fecha_em as string | null) ?? null,
        regras: (rs?.regras ?? []).map((r) => ({
          rotulo: String(r.rotulo ?? ""),
          resumo: resumirRegra(r),
        })),
      };
    })
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ ordem: _ordem, ...resto }) => resto);
}

export async function getPool(
  supabase: SupabaseClient,
  cardId: string
): Promise<AtletaDoPool[]> {
  const { data } = await supabase
    .from("escalacao_card_atleta")
    .select("id, esporte_key, escalacao_atleta(nome, genero)")
    .eq("card_id", cardId);

  return (data ?? [])
    .map((linha) => {
      const rel = linha.escalacao_atleta as unknown as
        | { nome: string; genero: string }
        | { nome: string; genero: string }[]
        | null;
      const a = Array.isArray(rel) ? rel[0] : rel;
      return {
        card_atleta_id: linha.id as string,
        esporte_key: linha.esporte_key as string,
        nome: a?.nome ?? "",
        genero: a?.genero ?? "misto",
      };
    })
    .filter((a) => a.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function getMeuTime(
  supabase: SupabaseClient,
  cardId: string,
  userId: string
): Promise<MeuTime | null> {
  const { data: time } = await supabase
    .from("escalacao_time")
    .select("id, status, nome, pontos_total, premio_z")
    .eq("card_id", cardId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!time) return null;

  const { data: slots } = await supabase
    .from("escalacao_time_atleta")
    .select("card_atleta_id, papel, ordem")
    .eq("time_id", time.id)
    .order("papel")
    .order("ordem");

  return { ...(time as Omit<MeuTime, "slots">), slots: (slots ?? []) as SlotDoTime[] };
}

export interface LinhaRanking {
  time_id: string;
  username: string;
  avatar_url: string | null;
  nome: string | null;
  pontos_total: number | null;
  premio_z: number | null;
  posicao: number;
}

export async function getRanking(
  supabase: SupabaseClient,
  cardId: string,
  limite = 50
): Promise<LinhaRanking[]> {
  const { data } = await supabase
    .from("v_escalacao_ranking")
    .select("time_id, username, avatar_url, nome, pontos_total, premio_z, posicao")
    .eq("card_id", cardId)
    .order("posicao")
    .limit(limite);
  return (data ?? []) as LinhaRanking[];
}
