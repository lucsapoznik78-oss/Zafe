// Apuração de um card: stats crus do banco → motor → pontos por atleta →
// acionamento de reserva → total do time.
//
// Tudo aqui é RECOMPUTADO DO ZERO. Recalcular precisa ser idempotente: uma
// correção de stat no meio da apuração não pode deixar resíduo do cálculo
// anterior (Art. 34 manda corrigir erro comprovado e republicar o ranking).
//
// Este arquivo não tem uma linha de código por esporte. O que decide como um
// valor é lido é a DECLARAÇÃO de stats do ruleset (`stats[].tipo`), que é dado
// em JSONB — mesma fonte que gera o formulário do admin.

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseRuleset, type Ruleset, type StatMap, type StatValue } from "./rules";
import {
  aplicarReservas,
  pontuarMes,
  type EventoStats,
  type Ocorrencia,
  type ResultadoMes,
  type SlotEntrada,
} from "./scoring";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface LinhaStat {
  evento_key: string;
  ordem: number;
  stat_key: string;
  valor_num: number | null;
  valor_txt: string | null;
  contexto: Record<string, number> | null;
}

/**
 * Converte uma linha crua no valor que o motor entende. O tipo vem do ruleset,
 * nunca de heurística sobre a linha: `false` e "não informado" são coisas
 * diferentes e adivinhar aqui erraria a pontuação de quem não competiu.
 */
function valorDoStat(rs: Ruleset, linha: LinhaStat): StatValue | undefined {
  const decl = rs.stats.find((s) => s.key === linha.stat_key);
  if (!decl) return undefined;

  switch (decl.tipo) {
    case "num":
      return linha.valor_num ?? undefined;
    case "bool":
      return (linha.valor_num ?? 0) !== 0;
    case "cat":
      return linha.valor_txt ?? undefined;
    case "lista":
      // Lista de números numa coluna só: "9,00" seria ambíguo em pt-BR, então o
      // separador é `;` e o decimal é `.` — o formulário grava nesse formato.
      return (linha.valor_txt ?? "")
        .split(";")
        .map((p) => Number(p.trim()))
        .filter((n) => Number.isFinite(n));
  }
}

/** Agrupa as linhas cruas de um atleta em eventos e sub-ocorrências. */
export function montarEventos(rs: Ruleset, linhas: LinhaStat[]): EventoStats[] {
  const porEvento = new Map<string, { stats: StatMap; ocorrencias: Map<number, Ocorrencia> }>();

  for (const linha of linhas) {
    const valor = valorDoStat(rs, linha);
    if (valor === undefined) continue;

    let ev = porEvento.get(linha.evento_key);
    if (!ev) {
      ev = { stats: {}, ocorrencias: new Map() };
      porEvento.set(linha.evento_key, ev);
    }

    if (linha.ordem === 0) {
      ev.stats[linha.stat_key] = valor;
      continue;
    }

    let oc = ev.ocorrencias.get(linha.ordem);
    if (!oc) {
      oc = { ordem: linha.ordem, stats: {} };
      ev.ocorrencias.set(linha.ordem, oc);
    }
    oc.stats[linha.stat_key] = valor;
    if (linha.contexto) oc.contexto = { ...oc.contexto, ...linha.contexto };
  }

  return Array.from(porEvento.entries()).map(([eventoKey, ev]) => ({
    eventoKey,
    stats: ev.stats,
    ocorrencias: Array.from(ev.ocorrencias.values()).sort((a, b) => a.ordem - b.ordem),
  }));
}

/** Pontuação de um atleta no mês. Puro — é o que o preview do admin chama. */
export function pontuarAtleta(
  rs: Ruleset,
  linhas: LinhaStat[],
  eventoDesignado?: string | null
): ResultadoMes {
  return pontuarMes(rs, montarEventos(rs, linhas), {
    eventoDesignado: eventoDesignado ?? undefined,
  });
}

/** Uma linha de `escalacao_regra` vira o Ruleset que o motor consome. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rulesetDaLinha(r: any): Ruleset {
  return parseRuleset({
    esporte: r.esporte_key,
    versao: r.versao,
    tetoEvento: Number(r.teto_evento),
    pisoEvento: Number(r.piso_evento),
    agregacaoMes: r.agregacao_mes,
    evAlvo: r.ev_alvo === null || r.ev_alvo === undefined ? undefined : Number(r.ev_alvo),
    regras: r.regras,
    stats: r.stats,
  });
}

export const COLUNAS_REGRA =
  "id, regras, stats, teto_evento, piso_evento, agregacao_mes, ev_alvo, esporte_key, versao";

export interface ResultadoApuracao {
  atletasCalculados: number;
  timesCalculados: number;
}

/**
 * Apura o card inteiro: pontua cada atleta do pool uma única vez (UFC §10 — a
 * nota do atleta é a mesma para todos os times que o escalaram) e só depois
 * deriva os times.
 *
 * Não paga nada. Pagar é `escalacao_pagar_card()`, num endpoint separado:
 * recalcular é reversível, pagar não.
 */
export async function apurarCard(admin: Db, cardId: string): Promise<ResultadoApuracao> {
  const { data: card, error: erroCard } = await admin
    .from("escalacao_card")
    .select("id, multiplicador_capitao")
    .eq("id", cardId)
    .single();
  if (erroCard || !card) throw new Error("Card não encontrado");

  const { data: esportes } = await admin
    .from("escalacao_card_esporte")
    .select("esporte_key, regra_id, evento_key")
    .eq("card_id", cardId);

  const { data: regras } = await admin
    .from("escalacao_regra")
    .select(COLUNAS_REGRA)
    .in("id", (esportes ?? []).map((e) => e.regra_id));

  const rulesetPorId = new Map<string, Ruleset>();
  for (const r of regras ?? []) {
    rulesetPorId.set(r.id, rulesetDaLinha(r));
  }
  const designadoPorEsporte = new Map(
    (esportes ?? []).map((e) => [e.esporte_key, e.evento_key as string | null])
  );

  const { data: pool } = await admin
    .from("escalacao_card_atleta")
    .select("id, esporte_key, regra_id, competiu")
    .eq("card_id", cardId);

  const { data: stats } = await admin
    .from("escalacao_stat")
    .select("card_atleta_id, evento_key, ordem, stat_key, valor_num, valor_txt, contexto")
    .in("card_atleta_id", (pool ?? []).map((p) => p.id));

  const statsPorAtleta = new Map<string, LinhaStat[]>();
  for (const s of stats ?? []) {
    const lista = statsPorAtleta.get(s.card_atleta_id) ?? [];
    lista.push({
      evento_key: s.evento_key,
      ordem: s.ordem,
      stat_key: s.stat_key,
      valor_num: s.valor_num === null ? null : Number(s.valor_num),
      valor_txt: s.valor_txt,
      contexto: s.contexto,
    });
    statsPorAtleta.set(s.card_atleta_id, lista);
  }

  let atletasCalculados = 0;
  const pontosPorAtleta = new Map<string, number>();

  for (const atleta of pool ?? []) {
    const rs = rulesetPorId.get(atleta.regra_id);
    if (!rs) continue;

    // Quem não competiu não pontua: a vaga passa para a reserva (Art. 19), e
    // pontuar stats residuais dele contaria duas vezes.
    const resultado =
      atleta.competiu === false
        ? { total: 0, porEvento: [] }
        : pontuarAtleta(
            rs,
            statsPorAtleta.get(atleta.id) ?? [],
            designadoPorEsporte.get(atleta.esporte_key)
          );

    pontosPorAtleta.set(atleta.id, resultado.total);

    const { error } = await admin
      .from("escalacao_card_atleta")
      .update({
        pontos: resultado.total,
        detalhe: resultado.porEvento,
        calculado_em: new Date().toISOString(),
      })
      .eq("id", atleta.id);
    if (error) throw new Error(`atleta ${atleta.id}: ${error.message}`);
    atletasCalculados++;
  }

  const competiuPorAtleta = new Map((pool ?? []).map((p) => [p.id, p.competiu as boolean | null]));

  const { data: times } = await admin
    .from("escalacao_time")
    .select("id, status")
    .eq("card_id", cardId)
    .in("status", ["inscrito", "travado", "apurado"]);

  let timesCalculados = 0;

  for (const time of times ?? []) {
    const { data: slots } = await admin
      .from("escalacao_time_atleta")
      .select("id, papel, ordem, capitao, card_atleta_id")
      .eq("time_id", time.id);

    const entrada: SlotEntrada[] = (slots ?? []).map((s) => ({
      id: s.id,
      papel: s.papel,
      ordem: s.ordem,
      capitao: s.capitao,
      competiu: competiuPorAtleta.get(s.card_atleta_id) ?? null,
      pontos: pontosPorAtleta.get(s.card_atleta_id) ?? null,
    }));

    const resultado = aplicarReservas(entrada, {
      multiplicadorCapitao: Number(card.multiplicador_capitao),
    });

    for (const slot of resultado.slots) {
      const { error } = await admin
        .from("escalacao_time_atleta")
        .update({
          pontua: slot.pontua,
          substituiu_id: slot.substituiuId,
          pontos_aplicados: slot.pontosAplicados,
        })
        .eq("id", slot.id);
      if (error) throw new Error(`slot ${slot.id}: ${error.message}`);
    }

    const { error } = await admin
      .from("escalacao_time")
      .update({ pontos_total: resultado.total, status: "apurado" })
      .eq("id", time.id);
    if (error) throw new Error(`time ${time.id}: ${error.message}`);
    timesCalculados++;
  }

  await admin
    .from("escalacao_card")
    .update({ status: "apurado", apurado_em: new Date().toISOString() })
    .eq("id", cardId);

  return { atletasCalculados, timesCalculados };
}
