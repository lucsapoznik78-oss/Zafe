/**
 * POST /api/admin/escalacao/[id]/pesquisar — a IA busca o desempenho real dos
 * atletas do pool e o motor converte em pontos.
 *
 * Duas ações no mesmo endpoint porque são o mesmo fluxo em dois tempos:
 *
 *   acao: "preview" — não grava NADA. Devolve o que a IA achou, já traduzido
 *   em pontos pelo ruleset do card, para o admin conferir.
 *
 *   acao: "gravar" — grava só o que o admin aprovou, roda a apuração e devolve
 *   a conferência (soma por usuário). Ainda não paga: pagar é rota separada,
 *   porque recalcular é reversível e pagar não.
 *
 * O clique humano entre as duas é a trava. A IA é uma fonte de dados, não uma
 * autoridade — num modo que EMITE Z$, gravar direto seria pagar com base num
 * palpite do modelo.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { apurarCard } from "@/lib/escalacao/apuracao";
import { conferirCard } from "@/lib/escalacao/conferencia";
import { gravarPropostas, pesquisarEsporte } from "@/lib/escalacao/pesquisa-ia";
import { exigirAdmin } from "@/lib/escalacao/queries";

// Web search em lotes sequenciais passa muito dos 60s padrão.
export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ id: string }>;
}

const linhaSchema = z.object({
  evento_key: z.string().min(1).max(60),
  ordem: z.number().int().min(0).max(200),
  stat_key: z.string().min(1).max(60),
  valor_num: z.number().nullable(),
  valor_txt: z.string().max(500).nullable(),
  contexto: z.record(z.string(), z.number()).nullable(),
});

const schema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("preview"),
    esporte_key: z.string().min(1).max(40),
    evento_key: z.string().min(1).max(60).optional(),
    atleta_ids: z.array(z.string().uuid()).max(200).optional(),
  }),
  z.object({
    acao: z.literal("gravar"),
    propostas: z
      .array(
        z.object({
          card_atleta_id: z.string().uuid(),
          evento_key: z.string().min(1).max(60),
          competiu: z.boolean(),
          motivo_ausencia: z.string().max(200).nullable(),
          linhas: z.array(linhaSchema).max(500),
        })
      )
      .min(1)
      .max(200),
  }),
]);

export async function POST(request: Request, { params }: RouteParams) {
  const { id: cardId } = await params;
  const guarda = await exigirAdmin();
  if ("erro" in guarda) return guarda.erro;
  const { admin, userId } = guarda;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const body = parsed.data;

  try {
    if (body.acao === "preview") {
      const resultado = await pesquisarEsporte(admin, cardId, body.esporte_key, {
        eventoKey: body.evento_key,
        atletaIds: body.atleta_ids,
      });
      return NextResponse.json({ success: true, ...resultado });
    }

    const gravados = await gravarPropostas(admin, cardId, userId, body.propostas);
    const apuracao = await apurarCard(admin, cardId);
    const conferencia = await conferirCard(admin, cardId);

    revalidatePath(`/admin/escalacao/${cardId}`);
    revalidatePath(`/admin/escalacao/${cardId}/apuracao`);
    revalidatePath(`/admin/escalacao/${cardId}/times`);

    return NextResponse.json({ success: true, gravados, ...apuracao, conferencia });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na pesquisa" },
      { status: 400 }
    );
  }
}
