// Conferência de um card: o que está inscrito, quanto pontuou e quanto isso
// emite em Z$.
//
// Existe porque `apurarCard` grava números e vai embora — não há, em lugar
// nenhum, uma tela que responda "quanto este card vai emitir?" antes de alguém
// clicar em pagar. Escalação é o único módulo que EMITE Z$, e a decisão de pagar
// é irreversível; conferir antes é a única defesa que sobra.
//
// Nada aqui escreve. É leitura pura, e por isso pode rodar quantas vezes for
// preciso, inclusive num card já pago.

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

export interface TimeConferido {
  time_id: string;
  username: string;
  nome: string | null;
  status: string;
  entrada_paga: number;
  titulares: number;
  reservas: number;
  pontos_total: number | null;
  z_a_emitir: number;
  problemas: string[];
}

export interface Conferencia {
  card: {
    id: string;
    titulo: string;
    modo: string;
    status: string;
    entrada_z: number;
    pontos_por_z: number;
    teto_emissao_z: number;
    n_titulares: number;
    n_reservas: number;
    fecha_em: string;
  };
  times: TimeConferido[];
  totais: {
    inscritos: number;
    rascunhos: number;
    z_debitado_esperado: number;
    z_debitado_registrado: number | null;
    pontos: number;
    z_a_emitir: number;
    estoura_teto: boolean;
    atletas_no_pool: number;
    atletas_sem_pontos: number;
  };
  /** Problemas do card inteiro, não de um time. */
  problemas: string[];
}

/**
 * Z$ que um time recebe pela pontuação. É a MESMA conta de
 * `escalacao_pagar_card()`: pontuação negativa não cobra nada de volta (o piso
 * por atleta já existe no ruleset; o total do time clampa em zero), e o
 * arredondamento é o do banco, duas casas.
 */
function zDoTime(pontos: number | null, pontosPorZ: number): number {
  if (pontos === null || pontos <= 0) return 0;
  return Math.round((pontos / pontosPorZ) * 100) / 100;
}

export async function conferirCard(admin: Db, cardId: string): Promise<Conferencia> {
  const { data: card, error } = await admin
    .from("escalacao_card")
    .select(
      "id, titulo, modo, status, entrada_z, pontos_por_z, teto_emissao_z, n_titulares, n_reservas, fecha_em"
    )
    .eq("id", cardId)
    .single();
  if (error || !card) throw new Error("Card não encontrado");

  const pontosPorZ = Number(card.pontos_por_z);
  const entradaZ = Number(card.entrada_z);

  const [{ data: times }, { data: pool }, { data: emissao }] = await Promise.all([
    admin
      .from("escalacao_time")
      .select("id, user_id, nome, status, entrada_paga, pontos_total, profiles(username)")
      .eq("card_id", cardId)
      .order("pontos_total", { ascending: false, nullsFirst: false }),
    admin.from("escalacao_card_atleta").select("id, pontos").eq("card_id", cardId),
    admin.from("escalacao_emissao").select("z_debitado").eq("card_id", cardId).maybeSingle(),
  ]);

  // Uma consulta só para os slots de todos os times: um SELECT por time faria a
  // página crescer em I/O junto com a inscrição.
  const ids = (times ?? []).map((t) => t.id);
  const { data: slots } = ids.length
    ? await admin
        .from("escalacao_time_atleta")
        .select("time_id, papel, card_atleta_id")
        .in("time_id", ids)
    : { data: [] as Array<{ time_id: string; papel: string; card_atleta_id: string }> };

  const porTime = new Map<string, { titulares: number; reservas: number; atletas: Set<string> }>();
  for (const s of slots ?? []) {
    const acc = porTime.get(s.time_id) ?? { titulares: 0, reservas: 0, atletas: new Set<string>() };
    if (s.papel === "titular") acc.titulares++;
    else acc.reservas++;
    acc.atletas.add(s.card_atleta_id);
    porTime.set(s.time_id, acc);
  }

  const conferidos: TimeConferido[] = (times ?? []).map((t) => {
    const acc = porTime.get(t.id) ?? { titulares: 0, reservas: 0, atletas: new Set<string>() };
    const inscrito = t.status !== "rascunho";
    const pontos = t.pontos_total === null ? null : Number(t.pontos_total);
    const problemas: string[] = [];

    // Só cobra composição de quem se inscreveu: rascunho incompleto é o estado
    // normal de quem ainda está montando.
    if (inscrito) {
      if (acc.titulares !== card.n_titulares) {
        problemas.push(`${acc.titulares} titulares, esperado ${card.n_titulares}`);
      }
      if (acc.reservas !== card.n_reservas) {
        problemas.push(`${acc.reservas} reservas, esperado ${card.n_reservas}`);
      }
      if (Number(t.entrada_paga) !== entradaZ) {
        problemas.push(`pagou ${Number(t.entrada_paga)} Z$, entrada é ${entradaZ} Z$`);
      }
    }
    if (acc.atletas.size !== acc.titulares + acc.reservas) {
      problemas.push("atleta repetido entre titulares e reservas");
    }

    const rel = t.profiles as unknown as { username: string } | { username: string }[] | null;

    return {
      time_id: t.id,
      username: (Array.isArray(rel) ? rel[0]?.username : rel?.username) ?? t.user_id,
      nome: t.nome,
      status: t.status,
      entrada_paga: Number(t.entrada_paga),
      titulares: acc.titulares,
      reservas: acc.reservas,
      pontos_total: pontos,
      z_a_emitir: inscrito ? zDoTime(pontos, pontosPorZ) : 0,
      problemas,
    };
  });

  const inscritos = conferidos.filter((t) => t.status !== "rascunho");
  const zAEmitir = Math.round(inscritos.reduce((s, t) => s + t.z_a_emitir, 0) * 100) / 100;
  const semPontos = (pool ?? []).filter((p) => p.pontos === null).length;

  const problemas: string[] = [];
  if (zAEmitir > Number(card.teto_emissao_z)) {
    problemas.push(
      `A emissão (${zAEmitir} Z$) estoura o teto do card (${Number(card.teto_emissao_z)} Z$). ` +
        "O pagamento seria recusado inteiro — investigue a pontuação antes de mexer no teto."
    );
  }
  if (inscritos.length > 0 && semPontos > 0) {
    problemas.push(
      `${semPontos} de ${(pool ?? []).length} atletas do pool ainda sem pontuação. ` +
        "Os times que os escalaram estão sendo somados com zero."
    );
  }
  const debitadoEsperado = inscritos.length * entradaZ;
  const debitadoRegistrado = emissao ? Number(emissao.z_debitado) : null;
  if (debitadoRegistrado !== null && debitadoRegistrado !== debitadoEsperado) {
    problemas.push(
      `escalacao_emissao.z_debitado (${debitadoRegistrado} Z$) não bate com ` +
        `${inscritos.length} inscritos × ${entradaZ} Z$ = ${debitadoEsperado} Z$.`
    );
  }

  return {
    card: {
      id: card.id,
      titulo: card.titulo,
      modo: card.modo,
      status: card.status,
      entrada_z: entradaZ,
      pontos_por_z: pontosPorZ,
      teto_emissao_z: Number(card.teto_emissao_z),
      n_titulares: card.n_titulares,
      n_reservas: card.n_reservas,
      fecha_em: card.fecha_em,
    },
    times: conferidos,
    totais: {
      inscritos: inscritos.length,
      rascunhos: conferidos.length - inscritos.length,
      z_debitado_esperado: debitadoEsperado,
      z_debitado_registrado: debitadoRegistrado,
      pontos: Math.round(inscritos.reduce((s, t) => s + (t.pontos_total ?? 0), 0) * 100) / 100,
      z_a_emitir: zAEmitir,
      estoura_teto: zAEmitir > Number(card.teto_emissao_z),
      atletas_no_pool: (pool ?? []).length,
      atletas_sem_pontos: semPontos,
    },
    problemas,
  };
}
