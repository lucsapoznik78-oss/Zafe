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
 * cada modo. Ordenado com o mix primeiro porque é o carro-chefe e é o único que
 * existe hoje; dentro do fixo, o mais recente na frente.
 */
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

  return vigentes.sort((a, b) => {
    if (a.modo !== b.modo) return a.modo === "mix" ? -1 : 1;
    return b.mes.localeCompare(a.mes);
  });
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
