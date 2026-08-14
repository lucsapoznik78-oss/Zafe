// Leituras da superfície pública do Modo Escalação.
//
// Ao contrário de `queries.ts` (admin, service role), tudo aqui roda com o
// cliente do usuário: as policies de SELECT já escondem card em rascunho,
// ruleset não publicado e a escalação alheia antes do fechamento.

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O desenho do time do modo fixo (migration 081). NULL no mix, onde qualquer
 * atleta serve em qualquer slot.
 *
 * O índice do slot — achatando `linhas` na ordem — é o `ordem` do titular. É por
 * isso que a UI e a API trafegam arrays com buracos em vez de listas compactas.
 * `pos: null` = slot livre (o FLEX da NFL, o quinto do Valorant).
 */
export interface SlotFormacao {
  rotulo: string;
  pos: string[] | null;
}

export interface Formacao {
  layout: "campo" | "quadra" | "lista";
  resumo: string;
  linhas: SlotFormacao[][];
  banco: SlotFormacao[];
}

export interface CardPublico {
  id: string;
  titulo: string;
  mes: string;
  modo: "mix" | "fixo";
  status: string;
  n_titulares: number;
  n_reservas: number;
  teto_por_esporte: number;
  teto_conta_reservas: boolean;
  teto_por_clube: number | null;
  formacao: Formacao | null;
  entrada_z: number;
  abre_em: string;
  fecha_em: string;
  /** Esportes do card, na ordem do catálogo. Preenchido por `getCardsVigentes`. */
  esportes: string[];
}

const COLUNAS_CARD =
  "id, titulo, mes, modo, status, n_titulares, n_reservas, teto_por_esporte, teto_conta_reservas, teto_por_clube, formacao, entrada_z, abre_em, fecha_em";

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
  /** Curadoria progressiva (migration 079): sem foto a UI desenha as iniciais. */
  foto_url: string | null;
  clube: string | null;
  posicao: string | null;
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
 * Todas as Convocações vigentes, uma por modo. O usuário escolhe entre elas com
 * as abas do topo — o mix (vários esportes) e cada card de modo fixo (uma
 * competição só).
 *
 * A policy já esconde rascunho, então "vigente" aqui é o card mais recente de
 * cada modo. A ordem do seletor é editorial (`ORDEM_SELETOR`), não derivada de
 * prazo nem de modo.
 */

/**
 * A ordem em que as Convocações aparecem no seletor — e, por tabela, qual delas
 * abre por padrão (a página cai no primeiro card quando não há `?c=`).
 *
 * É uma decisão de produto, não uma propriedade dos dados: o Brasileirão é o
 * esporte de maior alcance no Brasil e abre a página. Esporte fora da lista cai
 * no fim, em ordem alfabética — a chegada de tênis ou Champions não precisa
 * desta linha para funcionar.
 */
const ORDEM_SELETOR = ["futebol", "nba", "nfl", "mix", "valorant"];

/** Chave de ordenação: o mix é um bloco só; cada card de fixo é seu esporte. */
function chaveDeOrdem(card: CardPublico): string {
  return card.modo === "mix" ? "mix" : card.esportes[0] ?? "";
}

export async function getCardsVigentes(supabase: SupabaseClient): Promise<CardPublico[]> {
  const { data } = await supabase
    .from("escalacao_card")
    .select(COLUNAS_CARD)
    .order("mes", { ascending: false })
    .limit(20);

  const cards = (data ?? []) as unknown as CardPublico[];
  // Um por (modo, título): o índice único do schema já garante um card de mix
  // por mês e um de fixo por competição por mês, então o primeiro de cada grupo
  // na ordem acima é o vigente.
  const vistos = new Set<string>();
  const vigentes = cards.filter((c) => {
    const chave = `${c.modo}:${c.titulo}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  // Os esportes de todos os cards de uma vez: o seletor pinta cada Convocação com
  // a cor do esporte, e um SELECT por card seria uma consulta por aba.
  const { data: esportes } = await supabase
    .from("escalacao_card_esporte")
    .select("card_id, esporte_key")
    .in("card_id", vigentes.map((c) => c.id));
  for (const c of vigentes) {
    c.esportes = (esportes ?? [])
      .filter((e) => e.card_id === c.id)
      .map((e) => e.esporte_key as string);
  }

  // Depois do preenchimento acima, não antes: a ordem depende de `esportes`.
  vigentes.sort((a, b) => {
    const ia = ORDEM_SELETOR.indexOf(chaveDeOrdem(a));
    const ib = ORDEM_SELETOR.indexOf(chaveDeOrdem(b));
    if (ia !== ib) return (ia < 0 ? ORDEM_SELETOR.length : ia) - (ib < 0 ? ORDEM_SELETOR.length : ib);
    return a.titulo.localeCompare(b.titulo, "pt-BR");
  });

  return vigentes;
}

/**
 * `card_id → status` dos times do usuário. É o que deixa o seletor mostrar de
 * relance em quais Convocações ele já entrou — e quantas ainda faltam.
 */
export async function getMeusTimes(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("escalacao_time")
    .select("card_id, status")
    .eq("user_id", userId);
  return Object.fromEntries((data ?? []).map((t) => [t.card_id as string, t.status as string]));
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
    .select("id, esporte_key, escalacao_atleta(nome, genero, foto_url, clube, posicao)")
    .eq("card_id", cardId);

  type Rel = {
    nome: string;
    genero: string;
    foto_url: string | null;
    clube: string | null;
    posicao: string | null;
  };

  return (data ?? [])
    .map((linha) => {
      const rel = linha.escalacao_atleta as unknown as Rel | Rel[] | null;
      const a = Array.isArray(rel) ? rel[0] : rel;
      return {
        card_atleta_id: linha.id as string,
        esporte_key: linha.esporte_key as string,
        nome: a?.nome ?? "",
        genero: a?.genero ?? "misto",
        foto_url: a?.foto_url ?? null,
        clube: a?.clube ?? null,
        posicao: a?.posicao ?? null,
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
