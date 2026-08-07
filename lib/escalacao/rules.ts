// Modo Escalação — o DSL de pontuação.
//
// POR QUE UM DSL E NÃO UMA TABELA (esporte, stat_key, pontos_por_unidade):
// o modelo linear é insuficiente e os dois manuais já publicados provam isso.
// Nenhuma destas linhas é `valor × fator`:
//
//   UFC §3   bônus de método só para o VENCEDOR      → condicional sobre outro stat
//   UFC §4   round 1 +15 · 2 +10 · 3 +6 · 4/5 +4     → lookup categórico
//   UFC §4   até 60s → +10                            → limiar sobre contínuo
//   UFC §5   controle +1 a cada 2 min COMPLETOS       → floor(v / 120)
//   Surf §2  avanço = 6 × surfistas ÷ vagas           → fórmula que lê o contexto
//   Surf §4  onda 8–8,99 +4 · 9–9,99 +8 · 10 +12      → faixa, por ocorrência
//   Surf §5  campeão +40 · vice +25 · SF +15 · QF +8  → lookup em degraus
//   Surf §7  teto +180 / piso −25                     → clamp sobre o agregado
//
// Sete tipos de regra cobrem os dois manuais inteiros. A consequência prática é
// que boxe, F1, Champions e tênis entram como INSERT em escalacao_regra — sem
// migration, sem deploy, sem código novo.

import { z } from "zod";

// ------------------------------------------------------------
// Valores de stat
// ------------------------------------------------------------
// Um stat pode ser número, texto (categoria), booleano ou LISTA de números.
// A lista existe para o surf: as duas ondas que compõem o somatório de uma
// bateria são um único stat com dois valores, e o bônus de nota se aplica a
// cada uma.
export const statValueSchema = z.union([
  z.number(),
  z.string(),
  z.boolean(),
  z.array(z.number()),
]);
export type StatValue = z.infer<typeof statValueSchema>;
export type StatMap = Record<string, StatValue>;

// ------------------------------------------------------------
// Guarda condicional
// ------------------------------------------------------------
// `quando` é uma lista: TODAS as condições precisam valer. É o que permite
// expressar "bônus de round só quando venceu E terminou antes do tempo" sem
// inventar um tipo de regra novo.
export const guardSchema = z.object({
  stat: z.string(),
  eq: z.union([z.string(), z.number(), z.boolean()]).optional(),
  ne: z.union([z.string(), z.number(), z.boolean()]).optional(),
  in: z.array(z.union([z.string(), z.number()])).optional(),
  gte: z.number().optional(),
  lte: z.number().optional(),
});
export type Guard = z.infer<typeof guardSchema>;

// ------------------------------------------------------------
// Expressão aritmética — AST ESTRUTURADA, não string
// ------------------------------------------------------------
// Sem parser, sem eval, sem superfície de injeção: o JSONB vem do banco e é
// avaliado por um switch de quatro casos.
export type Expr =
  | { op: "const"; v: number }
  | { op: "stat"; k: string }
  | { op: "+" | "-" | "*" | "/"; a: Expr; b: Expr };

export const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal("const"), v: z.number() }),
    z.object({ op: z.literal("stat"), k: z.string() }),
    z.object({
      op: z.enum(["+", "-", "*", "/"]),
      a: exprSchema,
      b: exprSchema,
    }),
  ])
);

// ------------------------------------------------------------
// Os sete tipos de regra
// ------------------------------------------------------------
const base = {
  // Vai literal para o breakdown que o usuário lê (Art. 34).
  rotulo: z.string(),
  quando: z.array(guardSchema).optional(),
  // true = a regra roda uma vez por sub-ocorrência (bateria, onda, corrida);
  // false/ausente = uma vez por evento.
  porOcorrencia: z.boolean().optional(),
};

export const regraSchema = z.discriminatedUnion("tipo", [
  // Valor categórico → pontos. Ex.: vitória +20, empate +8, derrota −10.
  z.object({
    ...base,
    tipo: z.literal("lookup"),
    stat: z.string(),
    mapa: z.record(z.string(), z.number()),
  }),
  // valor × fator. Ex.: golpe significativo × 0,3.
  // `teto`/`piso` clampam A LINHA (não o evento). F1 §5: cada posição ganhada
  // vale +3, "contabilizadas até 10 posições, teto de +30" — o teto existe para
  // que a penalidade de troca de motor, que é informação pública semanas antes,
  // não renda mais que vencer a corrida.
  z.object({
    ...base,
    tipo: z.literal("linear"),
    stat: z.string(),
    fator: z.number(),
    teto: z.number().optional(),
    piso: z.number().optional(),
  }),
  // floor(valor / bloco) × fator. Ex.: controle +1 a cada 2 min COMPLETOS.
  z.object({
    ...base,
    tipo: z.literal("bloco"),
    stat: z.string(),
    bloco: z.number().positive(),
    fator: z.number(),
  }),
  // Faixa de valor → pontos, por ocorrência do valor. Ex.: onda 9,00–9,99 → +8.
  z.object({
    ...base,
    tipo: z.literal("faixa"),
    stat: z.string(),
    faixas: z.array(
      z.object({ min: z.number(), max: z.number(), pontos: z.number() })
    ),
  }),
  // Limiar sobre contínuo. Ex.: terminou em até 60s → +10.
  z.object({
    ...base,
    tipo: z.literal("limiar"),
    stat: z.string(),
    op: z.enum(["<=", ">="]),
    valor: z.number(),
    pontos: z.number(),
  }),
  // Booleano → pontos. Ex.: Performance of the Night +10.
  z.object({
    ...base,
    tipo: z.literal("flag"),
    stat: z.string(),
    pontos: z.number(),
  }),
  // Fórmula. Ex.: avanço de bateria = 6 × surfistas ÷ vagas.
  z.object({
    ...base,
    tipo: z.literal("formula"),
    expr: exprSchema,
  }),
]);
export type Regra = z.infer<typeof regraSchema>;

// ------------------------------------------------------------
// Declaração dos stats — é ela que GERA o formulário do admin
// ------------------------------------------------------------
// Por causa disto o painel de apuração não tem uma linha de código por esporte:
// ele lê `stats` do ruleset e desenha os campos.
export const statDeclSchema = z.object({
  key: z.string(),
  tipo: z.enum(["num", "cat", "bool", "lista"]),
  rotulo: z.string(),
  opcoes: z.array(z.string()).optional(),   // só para `cat`
  porOcorrencia: z.boolean().optional(),
  ajuda: z.string().optional(),
});
export type StatDecl = z.infer<typeof statDeclSchema>;

export const rulesetSchema = z.object({
  esporte: z.string(),
  versao: z.number().int().positive(),
  // Clamp sobre o AGREGADO do evento (surf §7, adotado como regra do modo).
  tetoEvento: z.number(),
  pisoEvento: z.number(),
  // UFC §9 SOMA duas lutas no mês; surf §9 conta só o stop designado; F1 §3 tira
  // a MÉDIA das corridas em que o piloto largou.
  //
  // A média não é preferência de estilo: agosto e dezembro têm 1 GP e novembro
  // tem 4. Somando, um piloto escalado em novembro valeria quatro vezes um de
  // dezembro e todo mundo lotaria as vagas de F1 no mês cheio. Com média, o EV
  // fica em 33,8 nos quatro casos e só a dispersão muda (F1 §3). O manual de
  // tênis vai precisar da mesma solução — 5 partidas num Masters 1000.
  agregacaoMes: z.enum(["soma", "media", "melhor", "designado"]),
  // Alvo de calibragem: 33 a 36 pontos por atleta por mês (UFC §11).
  evAlvo: z.number().optional(),
  regras: z.array(regraSchema),
  stats: z.array(statDeclSchema),
});
export type Ruleset = z.infer<typeof rulesetSchema>;

/** Valida um ruleset vindo do banco (JSONB). Lança em caso de formato inválido. */
export function parseRuleset(input: unknown): Ruleset {
  return rulesetSchema.parse(input);
}
