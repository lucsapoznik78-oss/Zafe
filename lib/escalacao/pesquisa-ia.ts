// Pesquisa de stats por IA — Claude com web search preenche os stats que o
// ruleset declara, para cada atleta do pool de um esporte.
//
// A divisão de responsabilidade é o ponto inteiro deste arquivo: **a IA nunca
// diz quantos pontos o atleta fez.** Ela só responde fatos verificáveis ("2
// gols, 1 assistência, 90 minutos") e o motor determinístico de
// `lib/escalacao/scoring.ts` converte isso em pontos, com o mesmo ruleset
// congelado no card. Se a IA errar, o erro é de dado — visível, corrigível e
// auditável no breakdown do Art. 34. Se a IA desse os pontos, o erro seria
// invisível e o modo que EMITE Z$ estaria pagando com base num palpite.
//
// Nada aqui grava. `pesquisarEsporte` é leitura pura; a escrita é
// `gravarPropostas`, chamada só depois de um clique humano.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import { COLUNAS_REGRA, pontuarAtleta, rulesetDaLinha, type LinhaStat } from "./apuracao";
import type { Ruleset, StatDecl } from "./rules";
import type { ResultadoMes } from "./scoring";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sonnet, não Haiku como o oracle: aqui não é uma pergunta binária, é preencher
// dez campos tipados por atleta a partir de súmula. Haiku confunde os campos.
const MODELO = "claude-sonnet-4-6";

// Lotes pequenos: uma resposta com 30 atletas estoura o output e o modelo começa
// a truncar os últimos. Seis cabem com folga e ainda dão contexto compartilhado
// (a mesma partida) para o modelo buscar uma vez só.
const TAMANHO_LOTE = 6;
const LOTES_EM_PARALELO = 3;

export interface AtletaProposto {
  card_atleta_id: string;
  nome: string;
  esporte_key: string;
  evento_key: string;
  competiu: boolean;
  motivo_ausencia: string | null;
  linhas: LinhaStat[];
  pontos: number;
  porEvento: ResultadoMes["porEvento"];
  confianca: number;
  fonte: string;
  /** Preenchido quando a IA não achou o atleta ou devolveu lixo. */
  erro: string | null;
}

export interface PesquisaResultado {
  esporte_key: string;
  esporte_nome: string;
  evento_key: string;
  modelo: string;
  atletas: AtletaProposto[];
}

// ------------------------------------------------------------
// Extração da resposta
// ------------------------------------------------------------

/** Índice do `}` que fecha o `{` em `inicio`, respeitando strings e escapes. */
function fimDoObjeto(s: string, inicio: number): number {
  let profundidade = 0;
  let emString = false;
  let escapado = false;
  for (let i = inicio; i < s.length; i++) {
    const c = s[i];
    if (emString) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') emString = true;
    else if (c === "{") profundidade++;
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0) return i;
    }
  }
  return -1;
}

/**
 * Com web search o modelo quase sempre embrulha o JSON em prosa (é o mesmo
 * comportamento que quebrava o oracle antes do 2º passo). Aqui não dá para
 * fazer um 2º passo barato — a resposta é estruturada — então varremos o texto
 * atrás do primeiro objeto balanceado que tenha `atletas`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrairAtletas(raw: string): any[] | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidatos = [fence?.[1], raw].filter(Boolean) as string[];

  for (const texto of candidatos) {
    const marca = texto.indexOf('"atletas"');
    if (marca < 0) continue;
    for (let i = 0; i <= marca; i++) {
      if (texto[i] !== "{") continue;
      const fim = fimDoObjeto(texto, i);
      if (fim < 0) continue;
      try {
        const obj = JSON.parse(texto.slice(i, fim + 1));
        if (Array.isArray(obj?.atletas)) return obj.atletas;
      } catch {
        continue;
      }
    }
  }
  return null;
}

// ------------------------------------------------------------
// Conversão para linhas cruas
// ------------------------------------------------------------

/**
 * Um valor solto da IA vira uma linha de `escalacao_stat`. O tipo vem SEMPRE da
 * declaração do ruleset — o que a IA mandou é só matéria-prima. Valor que não
 * cabe no tipo declarado é descartado, nunca coagido: um `cat` fora das opções
 * pontuaria zero silenciosamente se passasse.
 */
function linhaDoValor(
  decl: StatDecl,
  eventoKey: string,
  ordem: number,
  valor: unknown,
  contexto: Record<string, number> | null
): LinhaStat | null {
  const base = { evento_key: eventoKey, ordem, stat_key: decl.key, contexto };

  switch (decl.tipo) {
    case "num": {
      const n = Number(valor);
      if (!Number.isFinite(n)) return null;
      return { ...base, valor_num: n, valor_txt: null };
    }
    case "bool": {
      const v = valor === true || valor === 1 || valor === "true";
      return { ...base, valor_num: v ? 1 : 0, valor_txt: null };
    }
    case "cat": {
      if (typeof valor !== "string") return null;
      const t = valor.trim();
      if (decl.opcoes && decl.opcoes.length > 0 && !decl.opcoes.includes(t)) return null;
      return { ...base, valor_num: null, valor_txt: t };
    }
    case "lista": {
      const bruto = Array.isArray(valor) ? valor : String(valor ?? "").split(";");
      const nums = bruto.map((v) => Number(v)).filter((n) => Number.isFinite(n));
      if (nums.length === 0) return null;
      return { ...base, valor_num: null, valor_txt: nums.join(";") };
    }
  }
}

function linhasDoBruto(
  rs: Ruleset,
  eventoKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bruto: any
): LinhaStat[] {
  const porKey = new Map(rs.stats.map((s) => [s.key, s]));
  const linhas: LinhaStat[] = [];

  for (const [key, valor] of Object.entries(bruto?.stats ?? {})) {
    const decl = porKey.get(key);
    if (!decl || valor === null || valor === undefined) continue;
    const linha = linhaDoValor(decl, eventoKey, 0, valor, null);
    if (linha) linhas.push(linha);
  }

  for (const oc of Array.isArray(bruto?.ocorrencias) ? bruto.ocorrencias : []) {
    const ordem = Number(oc?.ordem);
    if (!Number.isInteger(ordem) || ordem < 1 || ordem > 200) continue;
    const contexto =
      oc?.contexto && typeof oc.contexto === "object"
        ? (Object.fromEntries(
            Object.entries(oc.contexto)
              .map(([k, v]) => [k, Number(v)])
              .filter(([, v]) => Number.isFinite(v as number))
          ) as Record<string, number>)
        : null;
    for (const [key, valor] of Object.entries(oc?.stats ?? {})) {
      const decl = porKey.get(key);
      if (!decl || valor === null || valor === undefined) continue;
      const linha = linhaDoValor(decl, eventoKey, ordem, valor, contexto);
      if (linha) linhas.push(linha);
    }
  }

  return linhas;
}

// ------------------------------------------------------------
// Prompt
// ------------------------------------------------------------

function descreverStats(rs: Ruleset): string {
  return rs.stats
    .map((s) => {
      const tipo =
        s.tipo === "cat"
          ? `um destes textos exatos: ${(s.opcoes ?? []).map((o) => `"${o}"`).join(", ")}`
          : s.tipo === "bool"
            ? "true ou false"
            : s.tipo === "lista"
              ? "array de números"
              : "número";
      const partes = [`"${s.key}" — ${s.rotulo} — ${tipo}`];
      if (s.porOcorrencia) partes.push("VAI EM ocorrencias[]");
      if (s.ajuda) partes.push(s.ajuda);
      return `- ${partes.join(" · ")}`;
    })
    .join("\n");
}

const SISTEMA = `Você é o apurador de um fantasy game brasileiro. Sua função é
buscar o desempenho REAL de atletas em competições que já aconteceram e reportar
os números crus da súmula. Você NUNCA calcula pontuação — pontuação é feita por
outro sistema. Responda com JSON.

Regras absolutas:
- Só reporte número que você confirmou em fonte. Não estime, não arredonde por
  conta própria, não invente.
- Se não achar dados do atleta, devolva "confianca": 0 e "stats": {}.
- Se o atleta não entrou em campo/octógono/água no período, "competiu": false e
  explique em "motivo".
- Nunca invente um atleta que não está na lista.`;

function montarPrompt(
  rs: Ruleset,
  contexto: { esporte: string; competicao: string | null; mes: string; eventoKey: string },
  nomes: string[]
): string {
  const temOcorrencia = rs.stats.some((s) => s.porOcorrencia);
  return `Esporte: ${contexto.esporte}${contexto.competicao ? ` · ${contexto.competicao}` : ""}
Período apurado: ${contexto.mes}
Identificador do evento: ${contexto.eventoKey}

Busque na web o desempenho real de cada atleta abaixo neste período e preencha os
campos. Se o atleta disputou mais de uma partida/luta/corrida no período, some os
números acumuláveis (gols, golpes) e reporte o total do período.

Atletas:
${nomes.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Campos a preencher:
${descreverStats(rs)}

Responda SOMENTE com JSON neste formato:
{"atletas":[{"nome":"<nome exato da lista acima>","competiu":true,"motivo":null,"stats":{"chave":valor},${
    temOcorrencia ? '"ocorrencias":[{"ordem":1,"stats":{"chave":valor},"contexto":{}}],' : ""
  }"confianca":90,"fonte":"https://..."}]}

"confianca" é 0 a 100 e mede o quanto você confirmou os números na fonte.${
    temOcorrencia
      ? '\nOs campos marcados "VAI EM ocorrencias[]" repetem por bateria/onda/corrida: cada ocorrência é um item do array com "ordem" começando em 1.'
      : ""
  }`;
}

async function pesquisarLote(
  rs: Ruleset,
  contexto: { esporte: string; competicao: string | null; mes: string; eventoKey: string },
  nomes: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[] | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resposta = await (client.beta.messages.create as any)({
      model: MODELO,
      max_tokens: 4096,
      betas: ["web-search-2025-03-05"],
      system: SISTEMA,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: montarPrompt(rs, contexto, nomes) }],
    });
    const texto = resposta.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text)
      .join("\n");
    return extrairAtletas(texto);
  } catch (e) {
    console.warn("[escalacao/pesquisa-ia] lote falhou:", String(e).slice(0, 300));
    return null;
  }
}

// ------------------------------------------------------------
// Pesquisa
// ------------------------------------------------------------

export async function pesquisarEsporte(
  admin: Db,
  cardId: string,
  esporteKey: string,
  opcoes?: { eventoKey?: string; atletaIds?: string[] }
): Promise<PesquisaResultado> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada");
  }

  const { data: card } = await admin
    .from("escalacao_card")
    .select("id, titulo, mes, modo")
    .eq("id", cardId)
    .single();
  if (!card) throw new Error("Card não encontrado");

  const { data: cardEsporte } = await admin
    .from("escalacao_card_esporte")
    .select("regra_id, evento_key")
    .eq("card_id", cardId)
    .eq("esporte_key", esporteKey)
    .single();
  if (!cardEsporte) throw new Error("Esporte não faz parte deste card");

  const eventoKey = opcoes?.eventoKey?.trim() || cardEsporte.evento_key || `${esporteKey}-${card.mes}`;

  const [{ data: regra }, { data: esporte }] = await Promise.all([
    admin.from("escalacao_regra").select(COLUNAS_REGRA).eq("id", cardEsporte.regra_id).single(),
    admin.from("escalacao_esporte").select("nome").eq("key", esporteKey).single(),
  ]);
  if (!regra) throw new Error("Ruleset não encontrado");
  const rs = rulesetDaLinha(regra);

  let query = admin
    .from("escalacao_card_atleta")
    .select("id, escalacao_atleta(nome)")
    .eq("card_id", cardId)
    .eq("esporte_key", esporteKey);
  if (opcoes?.atletaIds?.length) query = query.in("id", opcoes.atletaIds);
  const { data: pool } = await query;

  const atletas = (pool ?? []).map((p) => {
    const rel = p.escalacao_atleta as unknown as { nome: string } | { nome: string }[] | null;
    return {
      id: p.id as string,
      nome: (Array.isArray(rel) ? rel[0]?.nome : rel?.nome) ?? (p.id as string),
    };
  });
  if (atletas.length === 0) {
    throw new Error("Nenhum atleta deste esporte no pool");
  }

  // Stats de OUTROS eventos entram na conta do preview: com `agregacaoMes`
  // "soma" ou "media" o total do mês depende deles, e um preview do evento
  // isolado mentiria exatamente nos casos em que a agregação importa.
  const { data: outras } = await admin
    .from("escalacao_stat")
    .select("card_atleta_id, evento_key, ordem, stat_key, valor_num, valor_txt, contexto")
    .in("card_atleta_id", atletas.map((a) => a.id))
    .neq("evento_key", eventoKey);

  const outrasPorAtleta = new Map<string, LinhaStat[]>();
  for (const s of outras ?? []) {
    const lista = outrasPorAtleta.get(s.card_atleta_id) ?? [];
    lista.push({
      evento_key: s.evento_key,
      ordem: s.ordem,
      stat_key: s.stat_key,
      valor_num: s.valor_num === null ? null : Number(s.valor_num),
      valor_txt: s.valor_txt,
      contexto: s.contexto,
    });
    outrasPorAtleta.set(s.card_atleta_id, lista);
  }

  const contexto = {
    esporte: esporte?.nome ?? esporteKey,
    competicao: card.modo === "fixo" ? card.titulo : null,
    mes: new Date(`${card.mes}T12:00:00Z`).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }),
    eventoKey,
  };

  const lotes: typeof atletas[] = [];
  for (let i = 0; i < atletas.length; i += TAMANHO_LOTE) {
    lotes.push(atletas.slice(i, i + TAMANHO_LOTE));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const respostas: (any[] | null)[] = [];
  for (let i = 0; i < lotes.length; i += LOTES_EM_PARALELO) {
    const janela = lotes.slice(i, i + LOTES_EM_PARALELO);
    respostas.push(
      ...(await Promise.all(
        janela.map((lote) => pesquisarLote(rs, contexto, lote.map((a) => a.nome)))
      ))
    );
  }

  const propostas: AtletaProposto[] = [];

  lotes.forEach((lote, i) => {
    const resposta = respostas[i];
    // Casamento por nome normalizado: o modelo devolve "Neymar Jr." onde o pool
    // tem "Neymar Jr" e comparação exata perderia metade das linhas.
    const porNome = new Map(
      (resposta ?? []).map((r) => [normalizar(String(r?.nome ?? "")), r])
    );

    for (const atleta of lote) {
      const bruto = porNome.get(normalizar(atleta.nome));
      const base = {
        card_atleta_id: atleta.id,
        nome: atleta.nome,
        esporte_key: esporteKey,
        evento_key: eventoKey,
      };

      if (!bruto) {
        propostas.push({
          ...base,
          competiu: true,
          motivo_ausencia: null,
          linhas: [],
          pontos: 0,
          porEvento: [],
          confianca: 0,
          fonte: "",
          erro: resposta === null ? "A IA não respondeu para este lote" : "A IA não achou este atleta",
        });
        continue;
      }

      const competiu = bruto.competiu !== false;
      const linhas = competiu ? linhasDoBruto(rs, eventoKey, bruto) : [];
      const resultado = competiu
        ? pontuarAtleta(rs, [...linhas, ...(outrasPorAtleta.get(atleta.id) ?? [])], cardEsporte.evento_key)
        : { total: 0, porEvento: [] };

      propostas.push({
        ...base,
        competiu,
        motivo_ausencia:
          typeof bruto.motivo === "string" && bruto.motivo.trim()
            ? bruto.motivo.trim().slice(0, 200)
            : null,
        linhas,
        pontos: resultado.total,
        porEvento: resultado.porEvento,
        confianca: Number.isFinite(Number(bruto.confianca)) ? Number(bruto.confianca) : 0,
        fonte: typeof bruto.fonte === "string" ? bruto.fonte : "",
        erro:
          competiu && linhas.length === 0
            ? "A IA respondeu sem nenhum stat aproveitável"
            : null,
      });
    }
  });

  return {
    esporte_key: esporteKey,
    esporte_nome: contexto.esporte,
    evento_key: eventoKey,
    modelo: MODELO,
    atletas: propostas,
  };
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// ------------------------------------------------------------
// Escrita
// ------------------------------------------------------------

export interface PropostaParaGravar {
  card_atleta_id: string;
  evento_key: string;
  competiu: boolean;
  motivo_ausencia: string | null;
  linhas: LinhaStat[];
}

/**
 * Grava as propostas aprovadas. Mesma semântica do lançamento manual:
 * substituição completa do evento, nunca acúmulo — relançar corrige.
 */
export async function gravarPropostas(
  admin: Db,
  cardId: string,
  userId: string,
  propostas: PropostaParaGravar[]
): Promise<number> {
  const ids = propostas.map((p) => p.card_atleta_id);
  const { data: doCard } = await admin
    .from("escalacao_card_atleta")
    .select("id")
    .eq("card_id", cardId)
    .in("id", ids);
  const permitidos = new Set((doCard ?? []).map((a) => a.id as string));

  let gravados = 0;

  for (const p of propostas) {
    if (!permitidos.has(p.card_atleta_id)) {
      throw new Error(`Atleta ${p.card_atleta_id} não pertence a este card`);
    }

    const { error: erroLimpeza } = await admin
      .from("escalacao_stat")
      .delete()
      .eq("card_atleta_id", p.card_atleta_id)
      .eq("evento_key", p.evento_key);
    if (erroLimpeza) throw new Error(erroLimpeza.message);

    if (p.linhas.length > 0) {
      const { error } = await admin.from("escalacao_stat").insert(
        p.linhas.map((l) => ({
          card_atleta_id: p.card_atleta_id,
          evento_key: p.evento_key,
          ordem: l.ordem,
          stat_key: l.stat_key,
          valor_num: l.valor_num,
          valor_txt: l.valor_txt,
          contexto: l.contexto,
          registrado_por: userId,
        }))
      );
      if (error) throw new Error(error.message);
    }

    const { error } = await admin
      .from("escalacao_card_atleta")
      .update({ competiu: p.competiu, motivo_ausencia: p.motivo_ausencia })
      .eq("id", p.card_atleta_id);
    if (error) throw new Error(error.message);

    gravados++;
  }

  return gravados;
}
